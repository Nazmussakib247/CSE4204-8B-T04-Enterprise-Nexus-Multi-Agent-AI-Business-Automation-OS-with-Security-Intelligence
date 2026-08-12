/**
 * Support Agent — ticket triage, sentiment trends, and reply drafting.
 */
const { z } = require('zod');
const { tool } = require('@langchain/core/tools');
const Joi = require('joi');
const { BaseAgent } = require('../ai/BaseAgent');
const { scopedQuery } = require('./tools/scopedQuery');
const { makeRetrieveKnowledgeTool, retrieveChunks } = require('./tools/retrieveKnowledge');
const { generateJson } = require('../ai/client');
const { writeAuditLog } = require('../utils/audit');

const SYSTEM_PROMPT = `You are the Enterprise NeXus Support Agent. You help the user manage their
support tickets: triage, sentiment trends, escalations, and reply drafts.

Rules:
- Use your tools to fetch real data before answering. Never invent tickets.
- You can only see the current user's own tickets.
- Only escalate a ticket when the user asks for it or the ticket is clearly urgent; say what you did.
- Ground policy or product answers in retrieve_knowledge results; do not invent policies.
- When you have enough information, reply with ONLY a JSON object:
  {"answer": "<your answer>", "sources": [{"title": "...", "snippet": "..."}]}
  Include sources whenever your answer relies on retrieved knowledge; otherwise omit the field.`;

const outputSchema = Joi.object({
  answer: Joi.string().min(1).required(),
  sources: Joi.array()
    .items(Joi.object({ title: Joi.string().required(), snippet: Joi.string().allow('').required() }))
    .optional(),
});

const buildTools = (userId, req) => [
  tool(
    async ({ status, urgency, sentiment, escalated, limit }) => {
      let q = scopedQuery('support_tickets', userId)
        .select('id, query, status, urgency, sentiment, intent, escalated, ai_status, created_at')
        .order('created_at', { ascending: false })
        .limit(Math.min(limit ?? 20, 50));
      if (status) q = q.eq('status', status);
      if (urgency) q = q.eq('urgency', urgency);
      if (sentiment) q = q.eq('sentiment', sentiment);
      if (escalated !== undefined) q = q.eq('escalated', escalated);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return JSON.stringify({ count: data.length, tickets: data });
    },
    {
      name: 'query_tickets',
      description: 'List the user\'s support tickets, optionally filtered by status (open|in_progress|resolved|escalated), urgency, sentiment, or escalated flag.',
      schema: z.object({
        status: z.enum(['open', 'in_progress', 'resolved', 'escalated']).optional(),
        urgency: z.enum(['low', 'medium', 'high']).optional(),
        sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
        escalated: z.boolean().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
    }
  ),

  tool(
    async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await scopedQuery('support_tickets', userId)
        .select('sentiment, urgency, status, escalated, created_at')
        .gte('created_at', since);
      if (error) throw new Error(error.message);

      const byDay = {};
      for (const t of data) {
        const day = String(t.created_at).slice(0, 10);
        byDay[day] = byDay[day] || { positive: 0, neutral: 0, negative: 0, unanalysed: 0 };
        byDay[day][t.sentiment || 'unanalysed']++;
      }
      const summary = {
        window_days: 30,
        total: data.length,
        negative: data.filter((t) => t.sentiment === 'negative').length,
        escalated: data.filter((t) => t.escalated).length,
        open: data.filter((t) => t.status === 'open').length,
        by_day: byDay,
      };
      return JSON.stringify(summary);
    },
    {
      name: 'get_sentiment_trends',
      description: 'Sentiment trend for the last 30 days: daily positive/neutral/negative counts plus totals for negative, escalated, and open tickets.',
      schema: z.object({}),
    }
  ),

  tool(
    async ({ id }) => {
      const { data, error } = await scopedQuery('support_tickets', userId)
        .update({ escalated: true, status: 'escalated', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error || !data) throw new Error('Ticket not found');

      // Write-action: explicit domain audit entry
      writeAuditLog({
        userId,
        action: 'agent:support.escalate_ticket',
        resourceType: 'support_ticket',
        resourceId: id,
        metadata: { urgency: data.urgency },
        req,
      });

      return JSON.stringify({ escalated: true, ticket: { id: data.id, status: data.status } });
    },
    {
      name: 'escalate_ticket',
      description: 'Escalate one support ticket by ID: sets escalated=true and status=escalated. This is a write action and is audited.',
      schema: z.object({ id: z.string() }),
    }
  ),

  tool(
    async ({ ticket_id }) => {
      const { data: ticket, error } = await scopedQuery('support_tickets', userId)
        .select('id, query, sentiment, urgency, intent')
        .eq('id', ticket_id)
        .single();
      if (error || !ticket) throw new Error('Ticket not found');

      // RAG grounding: pull the most relevant knowledge for this ticket
      let chunks = [];
      try {
        chunks = await retrieveChunks(userId, ticket.query, 5);
      } catch (_ragErr) {
        chunks = []; // draft still possible, just ungrounded
      }
      const knowledge = chunks.length
        ? chunks.map((c, i) => `[${i + 1}] ${c.title}: ${c.snippet}`).join('\n')
        : '(no relevant knowledge found)';

      const draft = await generateJson({
        systemInstruction:
          'You are a professional, empathetic customer-support writer. Ground every factual claim in the provided knowledge; never invent policies.',
        prompt: `Draft a reply to this customer support ticket.

Ticket: "${ticket.query}"
Detected sentiment: ${ticket.sentiment || 'unknown'} | urgency: ${ticket.urgency || 'unknown'} | intent: ${ticket.intent || 'unknown'}

RELEVANT KNOWLEDGE (cite only what you actually use):
${knowledge}

Write a concise (3-6 sentence) reply that acknowledges the issue, gives a concrete next step grounded in the knowledge above, and matches the tone to the sentiment.
Return {"reply": "...", "used_knowledge_indices": [<1-based indices of knowledge entries you relied on>]}.`,
        responseSchema: {
          type: 'object',
          properties: {
            reply: { type: 'string' },
            used_knowledge_indices: { type: 'array', items: { type: 'integer' } },
          },
          required: ['reply'],
        },
      });

      const used = Array.isArray(draft.used_knowledge_indices) ? draft.used_knowledge_indices : [];
      const sources = used
        .map((i) => chunks[i - 1])
        .filter(Boolean)
        .map((c) => ({ title: c.title, snippet: c.snippet.slice(0, 200) }));

      return JSON.stringify({ ticket_id, draft_reply: draft.reply, sources });
    },
    {
      name: 'draft_reply',
      description:
        'Generate a knowledge-grounded suggested reply for one ticket by ID. Returns the draft plus sources: [{title, snippet}] for the knowledge chunks it relied on. Read-only.',
      schema: z.object({ ticket_id: z.string() }),
    }
  ),

  makeRetrieveKnowledgeTool(userId),
];

const createSupportAgent = (userId, req) =>
  new BaseAgent({
    name: 'support',
    systemPrompt: SYSTEM_PROMPT,
    tools: buildTools(userId, req),
    outputSchema,
  });

module.exports = { createSupportAgent };
