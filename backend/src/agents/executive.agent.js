/**
 * Executive Agent — multi-agent orchestrator.
 *
 * Its tools ARE the four domain agents. Each delegation:
 *  - runs the sub-agent's full tool loop (its own data tools, scoped to user)
 *  - writes a row to `tasks` (agent_type, load={question}, result={answer})
 *    so every delegation is traceable in the existing task pipeline
 *  - reports progress through an optional onDelegation callback (used for SSE)
 */
const { z } = require('zod');
const { tool } = require('@langchain/core/tools');
const Joi = require('joi');
const supabase = require('../config/supabase');
const { BaseAgent } = require('../ai/BaseAgent');
const { createHrAgent } = require('./hr.agent');
const { createFinanceAgent } = require('./finance.agent');
const { createSupportAgent } = require('./support.agent');
const { createAnalyticsAgent } = require('./analytics.agent');
const { makeRetrieveKnowledgeTool } = require('./tools/retrieveKnowledge');
const logger = require('../utils/logger');

const SYSTEM_PROMPT = `You are the Enterprise NeXus Executive Agent — an orchestrator over four
specialist agents: HR, Finance, Support, and Analytics.

Rules:
- Besides delegation you have retrieve_knowledge for semantic lookup in the company
  knowledge base — use it for policy/documentation questions instead of delegating.
- You have NO other direct data access. To answer anything about the user's business,
  delegate to the relevant specialist agent(s) with a clear, self-contained question.
- Delegate only to the agents that are actually relevant. For cross-domain questions,
  delegate to several and synthesize their answers.
- The conversation context (summary + recent messages) is provided — use it to resolve
  references like "them" or "that candidate" BEFORE delegating.
- When you have what you need, reply with ONLY a JSON object: {"answer": "<your answer>"}.
- Be an executive: concise, prioritised, numbers first.`;

const outputSchema = Joi.object({ answer: Joi.string().min(1).required() });

const SUB_AGENTS = {
  hr: { factory: createHrAgent, label: 'HR' },
  finance: { factory: createFinanceAgent, label: 'Finance' },
  support: { factory: createSupportAgent, label: 'Support' },
  analytics: { factory: createAnalyticsAgent, label: 'Analytics' },
};

/** Record a delegation in the tasks table so it is traceable. */
const traceDelegation = async (userId, agentType, question, answer, status) => {
  try {
    await supabase.from('tasks').insert({
      user_id: userId,
      agent_type: agentType,
      status,
      load: { question, source: 'executive-orchestrator' },
      result: answer ? JSON.stringify({ answer }) : null,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
    });
  } catch (err) {
    logger.warn('[Executive] failed to trace delegation into tasks', { agentType, error: err.message });
  }
};

const makeDelegationTool = (agentKey, userId, req, onDelegation) => {
  const { factory, label } = SUB_AGENTS[agentKey];
  return tool(
    async ({ question }) => {
      if (onDelegation) onDelegation({ agent: agentKey, label, question, status: 'started' });
      try {
        const subAgent = factory(userId, req);
        const output = await subAgent.run(question, { userId, req });
        await traceDelegation(userId, agentKey, question, output.answer, 'completed');
        if (onDelegation) {
          onDelegation({
            agent: agentKey,
            label,
            question,
            status: 'completed',
            answer_preview: String(output.answer).slice(0, 200),
            sub_steps: (subAgent.lastRunSteps || []).map((s) => s.tool),
          });
        }
        return output.answer;
      } catch (err) {
        await traceDelegation(userId, agentKey, question, null, 'failed');
        if (onDelegation) onDelegation({ agent: agentKey, label, question, status: 'failed' });
        throw err;
      }
    },
    {
      name: `delegate_to_${agentKey}`,
      description: `Ask the ${label} specialist agent a question about the user's ${label.toLowerCase()} data. It will use its own tools and return a data-grounded answer.`,
      schema: z.object({
        question: z.string().min(3).describe('A clear, self-contained question for the specialist'),
      }),
    }
  );
};

/**
 * @param {string} userId
 * @param {object} [req]
 * @param {object} [opts]
 * @param {(d: object) => void} [opts.onDelegation]  progress callback (SSE)
 */
const createExecutiveAgent = (userId, req, { onDelegation } = {}) =>
  new BaseAgent({
    name: 'executive',
    systemPrompt: SYSTEM_PROMPT,
    tools: [
      ...Object.keys(SUB_AGENTS).map((k) => makeDelegationTool(k, userId, req, onDelegation)),
      makeRetrieveKnowledgeTool(userId),
    ],
    outputSchema,
  });

const BRIEFING_PROMPT = `Prepare today's executive briefing. Delegate one question to EACH of the four
specialist agents (HR, Finance, Support, Analytics) asking for their current domain summary:
key numbers, anything urgent, and one recommendation. Then synthesize everything into a single
briefing of 4-6 sentences: overall state first, then the most pressing items across domains.`;

/** Run the full orchestrated daily briefing. Returns { summary, delegations }. */
const runBriefingOrchestration = async (userId, req) => {
  const delegations = [];
  const agent = createExecutiveAgent(userId, req, { onDelegation: (d) => delegations.push(d) });
  const output = await agent.run(BRIEFING_PROMPT, { userId, req });
  return { summary: output.answer, delegations };
};

module.exports = { createExecutiveAgent, runBriefingOrchestration, SUB_AGENTS };
