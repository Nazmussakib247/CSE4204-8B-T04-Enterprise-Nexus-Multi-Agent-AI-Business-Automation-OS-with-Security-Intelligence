/**
 * Supertest coverage for POST /api/v1/agents/:agent/chat
 *
 * The LLM is mocked at the @langchain/google-genai boundary, so the REAL
 * BaseAgent tool loop, real agent tools, and real scopedQuery run — only the
 * model responses are scripted. Verifies:
 *  - the tool loop executes and the steps trace is returned
 *  - every DB access is scoped with .eq('user_id', <authenticated user>)
 *  - write-action tools produce explicit audit entries
 *  - typed AI failures surface as 503, not fake answers
 */
const request = require('supertest');

jest.mock('@sentry/node', () => ({ init: jest.fn(), withScope: jest.fn(), captureException: jest.fn() }));

// ── Scripted LLM ──────────────────────────────────────────────
jest.mock('@langchain/google-genai', () => {
  const state = { queue: [] };
  class ChatGoogleGenerativeAI {
    bindTools() {
      return { invoke: async () => state.queue.shift() };
    }
    async invoke() {
      return state.queue.shift();
    }
  }
  return { ChatGoogleGenerativeAI, __llm: state };
});

// ── Awaitable, call-recording Supabase mock ───────────────────
jest.mock('../config/supabase', () => {
  const state = { result: { data: [], error: null }, calls: [] };
  const builder = {};
  ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'gte', 'lte', 'ilike', 'order', 'range', 'limit', 'single'].forEach((m) => {
    builder[m] = jest.fn((...args) => {
      state.calls.push([m, ...args]);
      return builder;
    });
  });
  builder.then = (resolve, reject) => Promise.resolve(state.result).then(resolve, reject);
  return { from: jest.fn((table) => { state.calls.push(['from', table]); return builder; }), __state: state };
});

jest.mock('../utils/audit', () => ({ writeAuditLog: jest.fn() }));
jest.mock('../utils/webhook', () => ({ notifyN8n: jest.fn() }));
jest.mock('../utils/email', () => ({ sendPasswordReset: jest.fn(), sendEscalationEmail: jest.fn() }));

const TEST_USER = 'user-agents-test';
jest.mock('../middleware/auth.middleware', () => ({
  protect: (req, _res, next) => {
    req.user = { id: 'user-agents-test', role: 'employee' };
    next();
  },
  authorize: () => (_req, _res, next) => next(),
}));

const { __llm } = require('@langchain/google-genai');
const supabase = require('../config/supabase');
const { writeAuditLog } = require('../utils/audit');

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
  supabase.__state.calls = [];
  supabase.__state.result = { data: [], error: null };
});

const toolCallMsg = (name, args) => ({ content: '', tool_calls: [{ name, args, id: `tc-${name}` }] });
const finalMsg = (answer) => ({ content: JSON.stringify({ answer }), tool_calls: [] });

describe('POST /api/v1/agents/:agent/chat', () => {
  test('runs the HR tool loop and returns answer + steps trace', async () => {
    supabase.__state.result = {
      data: [
        { id: 'r1', candidate_name: 'Alice', ai_score: 91, recommendation: 'shortlist' },
        { id: 'r2', candidate_name: 'Bob', ai_score: 84, recommendation: 'shortlist' },
      ],
      error: null,
    };
    __llm.queue = [
      toolCallMsg('query_candidates', { recommendation: 'shortlist' }),
      finalMsg('You have 2 shortlisted candidates: Alice (91) and Bob (84).'),
    ];

    const res = await request(app)
      .post('/api/v1/agents/hr/chat')
      .send({ message: 'Who are my shortlisted candidates?' });

    expect(res.status).toBe(200);
    expect(res.body.agent).toBe('hr');
    expect(res.body.answer).toMatch(/2 shortlisted/);
    expect(res.body.steps).toHaveLength(1);
    expect(res.body.steps[0]).toMatchObject({ tool: 'query_candidates', success: true });
    expect(res.body.steps[0].result_summary).toContain('Alice');
  });

  test('every tool DB access is scoped to the authenticated user', async () => {
    supabase.__state.result = { data: [], error: null };
    __llm.queue = [
      toolCallMsg('query_expenses', { category: 'Travel' }),
      finalMsg('No Travel expenses found.'),
    ];

    const res = await request(app)
      .post('/api/v1/agents/finance/chat')
      .send({ message: 'Show my travel spend' });

    expect(res.status).toBe(200);
    // scopedQuery must inject user scoping BEFORE any tool-added filters
    const eqCalls = supabase.__state.calls.filter(([m]) => m === 'eq');
    expect(eqCalls).toContainEqual(['eq', 'user_id', TEST_USER]);
    expect(supabase.__state.calls).toContainEqual(['from', 'finance_records']);
    const firstEq = eqCalls[0];
    expect(firstEq).toEqual(['eq', 'user_id', TEST_USER]);
  });

  test('write-action tool (escalate_ticket) persists scoped update and writes explicit audit entry', async () => {
    supabase.__state.result = {
      data: { id: 't1', status: 'escalated', urgency: 'high' },
      error: null,
    };
    __llm.queue = [
      toolCallMsg('escalate_ticket', { id: 't1' }),
      finalMsg('Ticket t1 has been escalated.'),
    ];

    const res = await request(app)
      .post('/api/v1/agents/support/chat')
      .send({ message: 'Escalate ticket t1' });

    expect(res.status).toBe(200);
    expect(res.body.steps[0]).toMatchObject({ tool: 'escalate_ticket', success: true });

    // scoped write: update ... eq(user_id) ... eq(id, t1)
    const calls = supabase.__state.calls;
    expect(calls.find(([m]) => m === 'update')[1]).toMatchObject({ escalated: true, status: 'escalated' });
    expect(calls).toContainEqual(['eq', 'user_id', TEST_USER]);
    expect(calls).toContainEqual(['eq', 'id', 't1']);

    // explicit write-action audit entry (in addition to BaseAgent's per-tool audit)
    const actions = writeAuditLog.mock.calls.map(([a]) => a.action);
    expect(actions).toContain('agent:support.escalate_ticket'); // domain write audit
    expect(actions).toContain('agent:support:escalate_ticket'); // BaseAgent tool audit
    expect(actions).toContain('agent:support.chat'); // request-level audit
  });

  test('multi-iteration loop: two tool rounds then final answer', async () => {
    supabase.__state.result = { data: [], error: null };
    __llm.queue = [
      toolCallMsg('get_kpi_snapshot', {}),
      toolCallMsg('compute_module_stats', { module: 'hr' }),
      finalMsg('Pipeline is quiet: no data yet.'),
    ];

    const res = await request(app)
      .post('/api/v1/agents/analytics/chat')
      .send({ message: 'How is my pipeline?' });

    expect(res.status).toBe(200);
    expect(res.body.steps.map((s) => s.tool)).toEqual(['get_kpi_snapshot', 'compute_module_stats']);
  });

  test('returns 404 for unknown agent', async () => {
    const res = await request(app).post('/api/v1/agents/pirate/chat').send({ message: 'arr' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Unknown agent/);
  });

  test('returns 400 when message is missing', async () => {
    const res = await request(app).post('/api/v1/agents/hr/chat').send({});
    expect(res.status).toBe(400);
  });

  test('returns 503 (typed AI failure) when the model emits garbage — never a fake answer', async () => {
    __llm.queue = [{ content: 'this is not json', tool_calls: [] }];

    const res = await request(app)
      .post('/api/v1/agents/hr/chat')
      .send({ message: 'hello' });

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/unavailable/i);
    expect(res.body.answer).toBeUndefined();
  });

  test('agents route is NOT exposed on the legacy /api alias', async () => {
    const res = await request(app).post('/api/agents/hr/chat').send({ message: 'hi' });
    expect(res.status).toBe(404);
  });
});
