/**
 * API Integration Tests — HR, Finance, Support
 *
 * These tests hit the actual Express app (not a real Supabase DB).
 * Supabase calls are mocked via jest.mock so no live credentials
 * are required in CI.
 *
 * Run: npm test
 */

const request = require('supertest');

// ── Mock Sentry before server import ─────────────────────────
jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  withScope: jest.fn(),
  captureException: jest.fn(),
}));

// ── Mock Supabase ─────────────────────────────────────────────
jest.mock('../config/supabase', () => {
  const mockQuery = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn(),
    from: jest.fn().mockReturnThis(),
  };
  return {
    from: jest.fn(() => mockQuery),
    _mock: mockQuery,
  };
});

// ── Mock external services ────────────────────────────────────
jest.mock('../utils/gemini', () => ({
  screenCV: jest.fn().mockResolvedValue({
    ai_score: 85, confidence: 'high', recommendation: 'shortlist',
    narrative_summary: 'Strong candidate', score_breakdown: {},
  }),
  detectAnomaly: jest.fn().mockResolvedValue({
    is_anomaly: false, severity: 'low', ai_note: 'Normal transaction',
  }),
  analyseSentiment: jest.fn().mockResolvedValue({
    intent: 'billing_query', urgency: 'medium', sentiment: 'neutral',
    confidence: 'high', ai_response: 'Thank you for contacting support.',
  }),
}));

jest.mock('../utils/webhook', () => ({
  notifyN8n: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../utils/audit', () => ({
  writeAuditLog: jest.fn(),
}));

jest.mock('../utils/email', () => ({
  sendPasswordReset: jest.fn().mockResolvedValue(undefined),
  sendEscalationEmail: jest.fn().mockResolvedValue(undefined),
}));

// ── Auth middleware mock — injects req.user ───────────────────
jest.mock('../middleware/auth.middleware', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 'test-user-id', role: 'employee' };
    next();
  },
  requireRole: () => (_req, _res, next) => next(),
}));

// ── Import app after all mocks ────────────────────────────────
let app;
beforeAll(() => {
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  process.env.JWT_SECRET = 'test-jwt-secret-must-be-at-least-32chars';
  process.env.N8N_SECRET = 'test-n8n-secret';
  process.env.NODE_ENV = 'test';

  // Suppress env-validation exit by importing server after env is set
  app = require('../server');
});

afterEach(() => jest.clearAllMocks());

// ── Helpers ───────────────────────────────────────────────────
const supabase = require('../config/supabase');
const mock = () => supabase._mock;

// ── Health check ──────────────────────────────────────────────
describe('GET /health', () => {
  test('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });
});

// ── HR Reports ────────────────────────────────────────────────
describe('HR API — /api/hr/reports', () => {
  describe('GET /api/hr/reports', () => {
    test('returns 200 with paginated data', async () => {
      mock().single.mockResolvedValueOnce({ data: null, error: null });  // auth user lookup
      mock().range = jest.fn().mockResolvedValueOnce({
        data: [{ id: 'r1', candidate_name: 'Alice', job_title: 'Engineer', recommendation: 'shortlist' }],
        error: null,
        count: 1,
      });

      const res = await request(app).get('/api/hr/reports');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
    });
  });

  describe('GET /api/hr/reports/:id', () => {
    test('returns 404 when report not found', async () => {
      mock().single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

      const res = await request(app).get('/api/hr/reports/nonexistent-id');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });

    test('returns 200 with report when found', async () => {
      const report = { id: 'r1', candidate_name: 'Bob', job_title: 'Designer', ai_score: 72 };
      mock().single.mockResolvedValueOnce({ data: report, error: null });

      const res = await request(app).get('/api/hr/reports/r1');
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ id: 'r1', candidate_name: 'Bob' });
    });
  });

  describe('POST /api/hr/reports', () => {
    test('returns 400 when required fields missing', async () => {
      const res = await request(app)
        .post('/api/hr/reports')
        .send({ candidate_name: 'Alice' }); // missing job_title

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    test('returns 201 with created report', async () => {
      const created = { id: 'new-id', candidate_name: 'Carol', job_title: 'PM', ai_score: 85 };
      mock().single.mockResolvedValueOnce({ data: created, error: null });

      const res = await request(app)
        .post('/api/hr/reports')
        .send({ candidate_name: 'Carol', job_title: 'PM', cv_text: 'Experienced PM...' });

      expect(res.status).toBe(201);
    });
  });
});

// ── Finance Records ───────────────────────────────────────────
describe('Finance API — /api/finance/records', () => {
  describe('GET /api/finance/records', () => {
    test('returns 200 with paginated data', async () => {
      mock().range = jest.fn().mockResolvedValueOnce({
        data: [{ id: 'f1', category: 'Travel', amount: 250, expense_date: '2025-06-01' }],
        error: null,
        count: 1,
      });

      const res = await request(app).get('/api/finance/records');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
    });
  });

  describe('POST /api/finance/records', () => {
    test('returns 400 when required fields missing', async () => {
      const res = await request(app)
        .post('/api/finance/records')
        .send({ category: 'Travel' }); // missing amount and expense_date

      expect(res.status).toBe(400);
    });

    test('creates record with anomaly detection result', async () => {
      const created = {
        id: 'new-finance-id', category: 'Travel', amount: 250,
        expense_date: '2025-06-01', is_anomaly: false, severity: 'low',
      };
      mock().single.mockResolvedValueOnce({ data: created, error: null });

      const res = await request(app)
        .post('/api/finance/records')
        .send({ category: 'Travel', amount: 250, expense_date: '2025-06-01' });

      expect(res.status).toBe(201);
    });
  });

  describe('GET /api/finance/records/:id', () => {
    test('returns 404 when record not found', async () => {
      mock().single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

      const res = await request(app).get('/api/finance/records/bad-id');
      expect(res.status).toBe(404);
    });
  });
});

// ── Support Tickets ───────────────────────────────────────────
describe('Support API — /api/support/tickets', () => {
  describe('GET /api/support/tickets', () => {
    test('returns 200 with paginated tickets', async () => {
      mock().range = jest.fn().mockResolvedValueOnce({
        data: [{ id: 't1', query: 'Help with billing', status: 'open', urgency: 'medium' }],
        error: null,
        count: 1,
      });

      const res = await request(app).get('/api/support/tickets');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
    });
  });

  describe('POST /api/support/tickets', () => {
    test('returns 400 when query is missing', async () => {
      const res = await request(app).post('/api/support/tickets').send({});
      expect(res.status).toBe(400);
    });

    test('creates ticket with AI sentiment analysis', async () => {
      const created = {
        id: 'new-ticket-id', query: 'I need help with my invoice',
        status: 'open', urgency: 'medium', sentiment: 'neutral',
      };
      mock().single.mockResolvedValueOnce({ data: created, error: null });

      const res = await request(app)
        .post('/api/support/tickets')
        .send({ query: 'I need help with my invoice' });

      expect(res.status).toBe(201);
    });
  });

  describe('PATCH /api/support/tickets/:id/status', () => {
    test('returns 400 for invalid status value', async () => {
      const res = await request(app)
        .patch('/api/support/tickets/t1/status')
        .send({ status: 'invalid-status' });

      expect(res.status).toBe(400);
    });
  });
});
