/**
 * Executive orchestrator tests.
 *
 * - Sub-agents are MOCKED: delegation routing, task tracing, and memory
 *   persistence are verified against the real orchestrator + controller.
 * - The orchestrator's own LLM is scripted at the @langchain/google-genai
 *   boundary, so the real BaseAgent tool loop runs.
 */
const request = require('supertest');

jest.mock('@sentry/node', () => ({ init: jest.fn(), withScope: jest.fn(), captureException: jest.fn() }));

// ── Scripted orchestrator LLM ─────────────────────────────────
jest.mock('@langchain/google-genai', () => {
  const state = { queue: [], invocations: [] };
  class ChatGoogleGenerativeAI {
    bindTools() {
      return {
        invoke: async (messages) => {
          state.invocations.push(messages);
          return state.queue.shift();
        },
      };
    }
    async invoke(messages) {
      state.invocations.push(messages);
      return state.queue.shift();
    }
  }
  return { ChatGoogleGenerativeAI, __llm: state };
});

// ── Mocked sub-agents ─────────────────────────────────────────
const mockSubAgent = (answer, steps = []) => ({
  run: jest.fn().mockResolvedValue({ answer }),
  lastRunSteps: steps,
});
jest.mock('../agents/hr.agent', () => ({ createHrAgent: jest.fn() }));
jest.mock('../agents/finance.agent', () => ({ createFinanceAgent: jest.fn() }));
jest.mock('../agents/support.agent', () => ({ createSupportAgent: jest.fn() }));
jest.mock('../agents/analytics.agent', () => ({ createAnalyticsAgent: jest.fn() }));

// ── Rolling-summary LLM call (memory.js) ─────────────────────
jest.mock('../ai/client', () => {
  const actual = jest.requireActual('../ai/errors');
  return {
    generateJson: jest.fn().mockResolvedValue({ summary: 'updated rolling summary' }),
    getModelName: () => 'gemini-1.5-flash',
    getTimeoutMs: () => 30000,
    AiUnavailableError: actual.AiUnavailableError,
  };
});

// ── Awaitable Supabase mock with a per-query resolver ─────────
jest.mock('../config/supabase', () => {
  const state = {
    calls: [], // { table, op, args }
    resolver: () => ({ data: null, error: null }),
  };
  const from = jest.fn((table) => {
    const ops = [];
    const builder = {};
    ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'gte', 'lte', 'ilike', 'order', 'range', 'limit', 'single'].forEach((m) => {
      builder[m] = jest.fn((...args) => {
        ops.push(m);
        state.calls.push({ table, op: m, args });
        return builder;
      });
    });
    builder.then = (resolve, reject) =>
      Promise.resolve(state.resolver({ table, ops })).then(resolve, reject);
    return builder;
  });
  return { from, __state: state };
});

jest.mock('../utils/audit', () => ({ writeAuditLog: jest.fn() }));
jest.mock('../utils/webhook', () => ({ notifyN8n: jest.fn() }));
jest.mock('../utils/email', () => ({ sendPasswordReset: jest.fn(), sendEscalationEmail: jest.fn() }));

const TEST_USER = 'user-exec-test';
jest.mock('../middleware/auth.middleware', () => ({
  protect: (req, _res, next) => {
    req.user = { id: 'user-exec-test', role: 'manager' };
    next();
  },
  authorize: () => (_req, _res, next) => next(),
}));

const { __llm } = require('@langchain/google-genai');
const supabase = require('../config/supabase');
const { generateJson } = require('../ai/client');
const { createHrAgent } = require('../agents/hr.agent');
const { createFinanceAgent } = require('../agents/finance.agent');
const { createSupportAgent } = require('../agents/support.agent');
const { createAnalyticsAgent } = require('../agents/analytics.agent');

const CONV = { id: 'conv-1', user_id: TEST_USER, title: 'T', summary: null };

/** Default resolver covering the ask() flow; tests override pieces via wrap. */
const defaultResolver = ({ table, ops }) => {
  if (table === 'agent_conversations' && ops.includes('insert')) return { data: { ...CONV }, error: null };
  if (table === 'agent_conversations' && ops.includes('update')) return { data: null, error: null };
  if (table === 'agent_conversations') return { data: { ...CONV, summary: 'previous summary' }, error: null };
  if (table === 'agent_messages' && ops.includes('select')) return { data: [], error: null };
  return { data: null, error: null };
};

const toolCallMsg = (name, args) => ({ content: '', tool_calls: [{ name, args, id: `tc-${name}` }] });
const finalMsg = (answer) => ({ content: JSON.stringify({ answer }), tool_calls: [] });

let app;
beforeAll(() => {
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  process.env.JWT_SECRET = 'test-jwt-secret-must-be-at-least-32chars';
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.NODE_ENV = 'test';
  app = require('../server');
});

beforeEach(() => {
  jest.clearAllMocks();
  __llm.queue = [];
  __llm.invocations = [];
  supabase.__state.calls = [];
  supabase.__state.resolver = defaultResolver;
  createHrAgent.mockImplementation(() => mockSubAgent('HR: 3 shortlisted candidates.', [{ tool: 'query_candidates' }]));
  createFinanceAgent.mockImplementation(() => mockSubAgent('Finance: 2 critical anomalies.'));
  createSupportAgent.mockImplementation(() => mockSubAgent('Support: 5 open tickets.'));
  createAnalyticsAgent.mockImplementation(() => mockSubAgent('Analytics: overall score 78.'));
});

describe('POST /api/v1/executive/ask — orchestrator delegation', () => {
  test('delegates to sub-agents, traces to tasks table, returns answer + delegations (JSON mode)', async () => {
    __llm.queue = [
      toolCallMsg('delegate_to_hr', { question: 'How is hiring going?' }),
      toolCallMsg('delegate_to_finance', { question: 'Any anomalies?' }),
      finalMsg('Hiring is strong (3 shortlisted); watch 2 critical finance anomalies.'),
    ];

    const res = await request(app)
      .post('/api/v1/executive/ask')
      .send({ question: 'Give me a cross-company status.' });

    expect(res.status).toBe(200);
    expect(res.body.answer).toMatch(/3 shortlisted/);
    expect(res.body.conversation_id).toBe('conv-1');
    expect(res.body.delegations.map((d) => [d.agent, d.status])).toEqual([
      ['hr', 'completed'],
      ['finance', 'completed'],
    ]);

    // sub-agents called with the delegated question and the right user
    expect(createHrAgent).toHaveBeenCalledWith(TEST_USER, expect.anything());
    const hrInstance = createHrAgent.mock.results[0].value;
    expect(hrInstance.run).toHaveBeenCalledWith('How is hiring going?', expect.objectContaining({ userId: TEST_USER }));
    expect(createSupportAgent).not.toHaveBeenCalled();

    // each delegation traced into the tasks table
    const taskInserts = supabase.__state.calls.filter((c) => c.table === 'tasks' && c.op === 'insert');
    expect(taskInserts).toHaveLength(2);
    expect(taskInserts[0].args[0]).toMatchObject({
      user_id: TEST_USER,
      agent_type: 'hr',
      status: 'completed',
      load: { question: 'How is hiring going?', source: 'executive-orchestrator' },
    });
    expect(JSON.parse(taskInserts[0].args[0].result)).toEqual({ answer: 'HR: 3 shortlisted candidates.' });
  });

  test('failed delegation is traced as failed', async () => {
    createFinanceAgent.mockImplementation(() => ({
      run: jest.fn().mockRejectedValue(new Error('boom')),
      lastRunSteps: [],
    }));
    __llm.queue = [
      toolCallMsg('delegate_to_finance', { question: 'Any anomalies?' }),
      finalMsg('Finance data is unavailable right now.'),
    ];

    const res = await request(app)
      .post('/api/v1/executive/ask')
      .send({ question: 'Finance status?' });

    expect(res.status).toBe(200);
    const taskInserts = supabase.__state.calls.filter((c) => c.table === 'tasks' && c.op === 'insert');
    expect(taskInserts[0].args[0]).toMatchObject({ agent_type: 'finance', status: 'failed', result: null });
    expect(res.body.delegations[0]).toMatchObject({ agent: 'finance', status: 'failed' });
  });
});

describe('conversation memory', () => {
  test('persists user + tool + assistant messages and updates the rolling summary', async () => {
    __llm.queue = [
      toolCallMsg('delegate_to_support', { question: 'Open tickets?' }),
      finalMsg('You have 5 open tickets.'),
    ];

    const res = await request(app)
      .post('/api/v1/executive/ask')
      .send({ question: 'How busy is support?' });

    expect(res.status).toBe(200);

    const msgInserts = supabase.__state.calls.filter((c) => c.table === 'agent_messages' && c.op === 'insert');
    expect(msgInserts).toHaveLength(1);
    const rows = msgInserts[0].args[0];
    expect(rows.map((r) => r.role)).toEqual(['user', 'tool', 'assistant']);
    expect(rows[0].content).toBe('How busy is support?');
    expect(rows[1].content).toContain('[Support Agent]');
    expect(rows[2].content).toBe('You have 5 open tickets.');
    expect(rows[2].metadata.delegations[0]).toMatchObject({ agent: 'support', status: 'completed' });
    expect(rows.every((r) => r.conversation_id === 'conv-1')).toBe(true);

    // rolling summary generated and persisted
    expect(generateJson).toHaveBeenCalledTimes(1);
    const convUpdate = supabase.__state.calls.find((c) => c.table === 'agent_conversations' && c.op === 'update');
    expect(convUpdate.args[0]).toMatchObject({ summary: 'updated rolling summary' });
  });

  test('continuing a conversation feeds summary + history into the orchestrator prompt', async () => {
    supabase.__state.resolver = ({ table, ops }) => {
      if (table === 'agent_conversations' && !ops.includes('insert') && !ops.includes('update')) {
        return { data: { ...CONV, summary: 'previous summary about hiring' }, error: null };
      }
      if (table === 'agent_messages' && ops.includes('select')) {
        return {
          data: [
            { role: 'assistant', content: 'Earlier answer about Alice.', metadata: null, created_at: '2026-07-05' },
            { role: 'user', content: 'Tell me about Alice.', metadata: null, created_at: '2026-07-05' },
          ],
          error: null,
        };
      }
      return defaultResolver({ table, ops });
    };
    __llm.queue = [finalMsg('She remains the top candidate.')];

    const res = await request(app)
      .post('/api/v1/executive/ask')
      .send({ question: 'Is she still the best?', conversation_id: 'conv-1' });

    expect(res.status).toBe(200);

    // the orchestrator's first LLM input contains summary, history, and the new question
    const firstInvocation = __llm.invocations[0];
    const humanMsg = firstInvocation[firstInvocation.length - 1];
    const text = typeof humanMsg.content === 'string' ? humanMsg.content : JSON.stringify(humanMsg.content);
    expect(text).toContain('previous summary about hiring');
    expect(text).toContain('Tell me about Alice.');
    expect(text).toContain('NEW QUESTION: Is she still the best?');

    // no new conversation was created
    const convInserts = supabase.__state.calls.filter((c) => c.table === 'agent_conversations' && c.op === 'insert');
    expect(convInserts).toHaveLength(0);
  });

  test('404 for a conversation the user does not own', async () => {
    supabase.__state.resolver = ({ table, ops }) => {
      if (table === 'agent_conversations' && ops.includes('select')) {
        return { data: null, error: { message: 'not found' } };
      }
      return defaultResolver({ table, ops });
    };

    const res = await request(app)
      .post('/api/v1/executive/ask')
      .send({ question: 'hi there', conversation_id: 'someone-elses' });

    expect(res.status).toBe(404);
  });
});

describe('SSE streaming mode', () => {
  test('streams delegation, token, and done events', async () => {
    __llm.queue = [
      toolCallMsg('delegate_to_analytics', { question: 'KPIs?' }),
      finalMsg('Overall score is 78 and trending up.'),
    ];

    const res = await request(app)
      .post('/api/v1/executive/ask')
      .set('Accept', 'text/event-stream')
      .send({ question: 'How are we doing overall?' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);

    const body = res.text;
    expect(body).toContain('event: delegation');
    expect(body).toContain('"agent":"analytics"');
    expect(body).toContain('event: token');
    expect(body).toContain('event: done');
    expect(body).toContain('"conversation_id":"conv-1"');

    // reassemble token events → full answer
    const tokens = [...body.matchAll(/event: token\ndata: (.*)\n/g)].map((m) => JSON.parse(m[1]).text);
    expect(tokens.join('')).toBe('Overall score is 78 and trending up.');
  });

  test('GET /conversations and /conversations/:id/messages', async () => {
    supabase.__state.resolver = ({ table, ops }) => {
      if (table === 'agent_conversations' && ops.includes('order')) {
        return { data: [{ id: 'conv-1', title: 'T', summary: null, created_at: 'x', updated_at: 'y' }], error: null };
      }
      if (table === 'agent_conversations') return { data: { id: 'conv-1' }, error: null };
      if (table === 'agent_messages') {
        return { data: [{ id: 'm1', role: 'user', content: 'hi', metadata: null, created_at: 'x' }], error: null };
      }
      return { data: null, error: null };
    };

    const list = await request(app).get('/api/v1/executive/conversations');
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);

    const msgs = await request(app).get('/api/v1/executive/conversations/conv-1/messages');
    expect(msgs.status).toBe(200);
    expect(msgs.body.data[0]).toMatchObject({ role: 'user', content: 'hi' });
  });
});
