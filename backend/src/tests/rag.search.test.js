/**
 * RAG + semantic search tests.
 *
 * - match_documents → typed result mapping
 * - keyword fallback when embeddings are down (with ILIKE sanitization —
 *   regression test for the PostgREST .or() injection)
 * - RAG citations: draft_reply grounds in retrieved chunks and the agent
 *   surfaces sources[] through /agents/support/chat
 */
const request = require('supertest');

jest.mock('@sentry/node', () => ({ init: jest.fn(), withScope: jest.fn(), captureException: jest.fn() }));

// ── Scripted LLM (support agent loop) ─────────────────────────
jest.mock('@langchain/google-genai', () => {
  const state = { queue: [] };
  class ChatGoogleGenerativeAI {
    bindTools() { return { invoke: async () => state.queue.shift() }; }
    async invoke() { return state.queue.shift(); }
  }
  return { ChatGoogleGenerativeAI, __llm: state };
});

// ── Embeddings mocked at the module boundary ──────────────────
jest.mock('../ai/embeddings', () => {
  const actualErrors = jest.requireActual('../ai/errors');
  return {
    embedText: jest.fn(),
    embedBatch: jest.fn(),
    chunkText: jest.requireActual('../ai/embeddings').chunkText,
    upsertDocument: jest.fn().mockResolvedValue(1),
    safeEmbedHrReport: jest.fn(),
    safeEmbedFinanceRecord: jest.fn(),
    safeEmbedSupportTicket: jest.fn(),
    hrReportText: jest.fn(),
    financeRecordText: jest.fn(),
    supportTicketText: jest.fn(),
    __errors: actualErrors,
  };
});

// ── generateJson (draft_reply grounding call) ─────────────────
jest.mock('../ai/client', () => {
  const actual = jest.requireActual('../ai/errors');
  return {
    generateJson: jest.fn(),
    getModelName: () => 'gemini-1.5-flash',
    getTimeoutMs: () => 30000,
    AiUnavailableError: actual.AiUnavailableError,
  };
});

// ── Supabase mock: awaitable builder + rpc ────────────────────
jest.mock('../config/supabase', () => {
  const state = {
    calls: [],
    resolver: () => ({ data: [], error: null }),
    rpcResult: { data: [], error: null },
  };
  const from = jest.fn((table) => {
    const ops = [];
    const builder = {};
    ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'gte', 'lte', 'ilike', 'or', 'order', 'range', 'limit', 'single'].forEach((m) => {
      builder[m] = jest.fn((...args) => {
        ops.push(m);
        state.calls.push({ table, op: m, args });
        return builder;
      });
    });
    builder.then = (resolve, reject) => Promise.resolve(state.resolver({ table, ops })).then(resolve, reject);
    return builder;
  });
  const rpc = jest.fn(async (fn, params) => {
    state.calls.push({ table: `rpc:${fn}`, op: 'rpc', args: [params] });
    return state.rpcResult;
  });
  return { from, rpc, __state: state };
});

jest.mock('../utils/audit', () => ({ writeAuditLog: jest.fn() }));
jest.mock('../utils/webhook', () => ({ notifyN8n: jest.fn() }));
jest.mock('../utils/email', () => ({ sendPasswordReset: jest.fn(), sendEscalationEmail: jest.fn() }));

const TEST_USER = 'user-rag-test';
jest.mock('../middleware/auth.middleware', () => ({
  protect: (req, _res, next) => {
    req.user = { id: 'user-rag-test', role: 'employee' };
    next();
  },
  authorize: () => (_req, _res, next) => next(),
}));

const { __llm } = require('@langchain/google-genai');
const supabase = require('../config/supabase');
const { embedText } = require('../ai/embeddings');
const { generateJson } = require('../ai/client');
const { AiUnavailableError } = require('../ai/errors');
const { sanitizeIlikeTerm, mapMatchesToResults } = require('../controllers/search.controller');

const FAKE_VECTOR = Array(768).fill(0.01);

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
  supabase.__state.resolver = () => ({ data: [], error: null });
  supabase.__state.rpcResult = { data: [], error: null };
});

describe('match_documents result mapping', () => {
  test('semantic search maps RPC rows to typed results', async () => {
    embedText.mockResolvedValueOnce(FAKE_VECTOR);
    supabase.__state.rpcResult = {
      data: [
        { id: 'd1', title: 'Alice — Engineer', content: 'CV screening report for Alice...', chunk_index: 0, source_type: 'hr', source_id: 'r-9', similarity: 0.91 },
        { id: 'd2', title: 'Refund policy', content: 'Refunds are processed within 14 days...', chunk_index: 2, source_type: 'knowledge_base', source_id: 'kb-1', similarity: 0.85 },
      ],
      error: null,
    };

    const res = await request(app).get('/api/v1/search?q=refund policy for alice');

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('semantic');
    expect(res.body.results).toHaveLength(2);
    expect(res.body.results[0]).toMatchObject({
      type: 'hr',
      id: 'r-9',
      title: 'Alice — Engineer',
      link: '/hr/r-9',
    });
    expect(res.body.results[1]).toMatchObject({ type: 'knowledge', link: null, similarity: 0.85 });

    // RPC called with the user's scope and the query vector
    const rpcCall = supabase.__state.calls.find((c) => c.table === 'rpc:match_documents');
    expect(rpcCall.args[0]).toMatchObject({ p_user_id: TEST_USER, match_count: 10 });
    expect(rpcCall.args[0].query_embedding).toHaveLength(768);
  });

  test('mapMatchesToResults unit: builds links per source_type', () => {
    const mapped = mapMatchesToResults([
      { id: 'x', title: 'T', content: 'c', source_type: 'finance', source_id: 'f-1', similarity: 0.7 },
      { id: 'y', title: 'K', content: 'k', source_type: 'knowledge_base', source_id: 'kb', similarity: 0.6 },
    ]);
    expect(mapped[0].link).toBe('/finance/f-1');
    expect(mapped[1].link).toBeNull();
    expect(mapped[1].type).toBe('knowledge');
  });
});

describe('keyword fallback + ILIKE sanitization', () => {
  test('falls back to sanitized keyword search when embedding fails', async () => {
    embedText.mockRejectedValueOnce(new AiUnavailableError('embeddings down'));
    supabase.__state.resolver = () => ({ data: [], error: null });

    // classic PostgREST .or() injection attempt
    const evil = 'x),user_id.neq.(nobody';
    const res = await request(app).get(`/api/v1/search?q=${encodeURIComponent(evil)}`);

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('keyword');

    const orCalls = supabase.__state.calls.filter((c) => c.op === 'or');
    expect(orCalls.length).toBeGreaterThan(0);
    for (const call of orCalls) {
      const clause = call.args[0];
      // PostgREST parses commas/parens as filter syntax — none of the user's
      // may survive. (Dots are harmless literals inside an ilike pattern.)
      const userPart = clause.split('%')[1] || '';
      expect(userPart).not.toContain(',');
      expect(userPart).not.toContain('(');
      expect(userPart).not.toContain(')');
      // exactly the two intended clauses, no injected third clause
      expect(clause.split(',')).toHaveLength(2);
    }
  });

  test('sanitizeIlikeTerm strips PostgREST filter syntax', () => {
    expect(sanitizeIlikeTerm('normal query')).toBe('normal query');
    expect(sanitizeIlikeTerm('a),b.ilike.(c')).toBe('a b.ilike. c');
    expect(sanitizeIlikeTerm('  spaced   out  ')).toBe('spaced out');
    expect(sanitizeIlikeTerm('x'.repeat(300))).toHaveLength(100);
  });
});

describe('RAG citations in support agent', () => {
  test('draft_reply grounds in retrieved chunks and surfaces sources[]', async () => {
    // ticket fetch
    supabase.__state.resolver = ({ table }) =>
      table === 'support_tickets'
        ? { data: { id: 't1', query: 'How long do refunds take?', sentiment: 'neutral', urgency: 'low', intent: 'billing' }, error: null }
        : { data: [], error: null };

    // retrieval: embedText + match_documents
    embedText.mockResolvedValue(FAKE_VECTOR);
    supabase.__state.rpcResult = {
      data: [
        { id: 'k1', title: 'Refund policy', content: 'Refunds are processed within 14 business days.', source_type: 'knowledge_base', source_id: 'kb-1', similarity: 0.92 },
        { id: 'k2', title: 'Shipping FAQ', content: 'Shipping takes 3-5 days.', source_type: 'knowledge_base', source_id: 'kb-2', similarity: 0.4 },
      ],
      error: null,
    };

    // grounded draft generation: cites chunk [1]
    generateJson.mockResolvedValueOnce({
      reply: 'Refunds are processed within 14 business days of approval.',
      used_knowledge_indices: [1],
    });

    __llm.queue = [
      { content: '', tool_calls: [{ name: 'draft_reply', args: { ticket_id: 't1' }, id: 'tc1' }] },
      {
        content: JSON.stringify({
          answer: 'Suggested reply: Refunds are processed within 14 business days of approval.',
          sources: [{ title: 'Refund policy', snippet: 'Refunds are processed within 14 business days.' }],
        }),
        tool_calls: [],
      },
    ];

    const res = await request(app)
      .post('/api/v1/agents/support/chat')
      .send({ message: 'Draft a reply for ticket t1' });

    expect(res.status).toBe(200);

    // citation presence: the tool output carried grounded sources...
    const step = res.body.steps.find((s) => s.tool === 'draft_reply');
    expect(step.success).toBe(true);
    expect(step.result_summary).toContain('Refund policy');

    // ...and the agent's final response surfaces them to the client
    expect(res.body.sources).toEqual([
      { title: 'Refund policy', snippet: 'Refunds are processed within 14 business days.' },
    ]);

    // grounding prompt actually contained the retrieved knowledge
    const groundingPrompt = generateJson.mock.calls[0][0].prompt;
    expect(groundingPrompt).toContain('[1] Refund policy');
    expect(groundingPrompt).toContain('RELEVANT KNOWLEDGE');
  });

  test('retrieve_knowledge tool returns top chunks (executive orchestrator toolset)', async () => {
    embedText.mockResolvedValue(FAKE_VECTOR);
    supabase.__state.rpcResult = {
      data: [{ id: 'k1', title: 'Travel policy', content: 'Max per-diem is $75.', source_type: 'knowledge_base', source_id: 'kb-3', similarity: 0.88 }],
      error: null,
    };

    __llm.queue = [
      { content: '', tool_calls: [{ name: 'retrieve_knowledge', args: { query: 'per diem limit' }, id: 'tc2' }] },
      { content: JSON.stringify({ answer: 'The travel per-diem cap is $75.' }), tool_calls: [] },
    ];

    const res = await request(app)
      .post('/api/v1/agents/support/chat')
      .send({ message: 'What is our per diem limit?' });

    expect(res.status).toBe(200);
    expect(res.body.steps[0]).toMatchObject({ tool: 'retrieve_knowledge', success: true });
    expect(res.body.steps[0].result_summary).toContain('Travel policy');
  });
});
