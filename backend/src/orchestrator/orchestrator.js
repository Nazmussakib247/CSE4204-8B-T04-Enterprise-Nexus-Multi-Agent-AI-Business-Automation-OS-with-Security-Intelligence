const hrAgent        = require('../agents/HRAgent');
const financeAgent   = require('../agents/FinanceAgent');
const supportAgent   = require('../agents/SupportAgent');
const analyticsAgent = require('../agents/AnalyticsAgent');
const executiveAgent = require('../agents/ExecutiveAgent');
const TaskModel      = require('../models/Task');
const logger         = require('../utils/logger');

const AGENTS = {
  hr:        hrAgent,
  finance:   financeAgent,
  support:   supportAgent,
  analytics: analyticsAgent,
  executive: executiveAgent,
};

/**
 * Dispatch a single agent task.
 */
const dispatchSingle = async ({ userId, agentType, payload, text }, opts = {}) => {
  const task = await TaskModel.create({ userId, agentType, payload, text });
  await TaskModel.updateStatus(task.id, 'running');

  try {
    const agent  = AGENTS[agentType];
    if (!agent) throw new Error(`Unknown agent: ${agentType}`);

    const input  = payload || { cvText: text };
    const result = await agent.invoke(input, { userId, taskId: task.id, ...opts });

    await TaskModel.updateStatus(task.id, 'completed', result);
    return { task: { ...task, status: 'completed' }, result };
  } catch (err) {
    logger.error('Agent dispatch error', { agentType, error: err.message });
    await TaskModel.updateStatus(task.id, 'failed', { error: err.message });
    throw err;
  }
};

/**
 * Run multiple agents SEQUENTIALLY, passing each output to the next as context.
 */
const runSequential = async (steps, userId) => {
  const results = [];
  let context   = {};

  for (const step of steps) {
    const merged = { ...step.payload, ...context };
    const out    = await dispatchSingle({ userId, agentType: step.agentType, payload: merged });
    results.push({ agentType: step.agentType, result: out.result });
    context = { ...context, [`${step.agentType}Result`]: out.result };
  }
  return results;
};

/**
 * Run multiple agents in PARALLEL and aggregate.
 */
const runParallel = async (steps, userId) => {
  const settled = await Promise.allSettled(
    steps.map((step) =>
      dispatchSingle({ userId, agentType: step.agentType, payload: step.payload })
    )
  );
  return settled.map((s, i) => ({
    agentType: steps[i].agentType,
    status:    s.status,
    result:    s.status === 'fulfilled' ? s.value.result : null,
    error:     s.status === 'rejected'  ? s.reason.message : null,
  }));
};

/**
 * Named multi-agent workflows.
 */
const WORKFLOW_DEFINITIONS = {
  full_report: {
    description: 'Run all agents in parallel and synthesise an executive report.',
    mode: 'parallel',
    steps: [
      { agentType: 'hr',        payload: {} },
      { agentType: 'finance',   payload: {} },
      { agentType: 'support',   payload: {} },
      { agentType: 'analytics', payload: {} },
    ],
  },
  hr_then_analytics: {
    description: 'Screen candidates, then generate analytics on the results.',
    mode: 'sequential',
    steps: [
      { agentType: 'hr',        payload: {} },
      { agentType: 'analytics', payload: {} },
    ],
  },
};

const runNamedWorkflow = async (name, userId, overridePayload = {}) => {
  const def = WORKFLOW_DEFINITIONS[name];
  if (!def) throw new Error(`Unknown workflow: ${name}`);

  const steps = def.steps.map((s) => ({ ...s, payload: { ...s.payload, ...overridePayload } }));

  if (def.mode === 'sequential') return runSequential(steps, userId);
  return runParallel(steps, userId);
};

module.exports = {
  dispatchSingle,
  runSequential,
  runParallel,
  runNamedWorkflow,
  WORKFLOW_DEFINITIONS,
};
