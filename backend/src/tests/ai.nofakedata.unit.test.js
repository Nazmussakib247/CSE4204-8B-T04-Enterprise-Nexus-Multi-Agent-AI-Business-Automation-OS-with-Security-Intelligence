/**
 * No-fake-data behavior tests.
 *
 * 1. utils/gemini.js must propagate AiUnavailableError — never return fallback objects.
 * 2. Controllers must save records with ai_status='failed' and NULL AI fields
 *    (no fake scores) and return 201 with a warning.
 * 3. retry-analysis endpoints must re-run the AI and update the row.
 */

jest.mock('../ai/client', () => {
  const actualErrors = jest.requireActual('../ai/errors');
  return {
    generateJson: jest.fn(),
    getModelName: () => 'gemini-1.5-flash',
    getTimeoutMs: () => 30000,
    AiUnavailableError: actualErrors.AiUnavailableError,
  };
});

jest.mock('../config/supabase', () => {
  const api = {};
  ['insert', 'select', 'update', 'eq', 'order', 'range', 'in', 'gte', 'lt', 'lte', 'delete'].forEach(
    (m) => {
      api[m] = jest.fn(() => api);
    }
  );
  api.single = jest.fn();
  return { from: jest.fn(() => api), __api: api };
});

jest.mock('../utils/webhook', () => ({ notifyN8n: jest.fn() }));
jest.mock('../utils/audit', () => ({ writeAuditLog: jest.fn() }));
jest.mock('../utils/logger', () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn() }));
jest.mock('../utils/email', () => ({ sendEscalationEmail: jest.fn().mockResolvedValue() }));
jest.mock('../utils/fileExtract', () => ({ extractText: jest.fn() }));

const { generateJson } = require('../ai/client');
const { AiUnavailableError } = require('../ai/errors');
const supabase = require('../config/supabase');
const { notifyN8n } = require('../utils/webhook');
const gemini = require('../utils/gemini');
const hr = require('../controllers/hr.controller');
const support = require('../controllers/support.controller');

const aiDown = () => new AiUnavailableError('Gemini unavailable: 503', { reason: 'api_error' });

const mockRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};
const mockReq = (overrides = {}) => ({
  user: { id: 'user-1', name: 'Test User' },
  headers: {},
  params: {},
  body: {},
  query: {},
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GEMINI_API_KEY = 'test-key';
});

describe('utils/gemini — no fake fallback data', () => {
  test.each([
    ['screenCV', () => gemini.screenCV({ candidate_name: 'A', job_title: 'B' })],
    ['detectAnomaly', () => gemini.detectAnomaly({ category: 'Travel', amount: 10, expense_date: '2026-01-01' })],
    ['analyseSentiment', () => gemini.analyseSentiment({ query: 'help' })],
    ['generateAnalyticsReport', () => gemini.generateAnalyticsReport({ hr: [], finance: [], support: [] })],
    ['parseInvoice', () => gemini.parseInvoice({ invoice_text: 'x' })],
  ])('%s throws AiUnavailableError instead of returning fallback values', async (_name, call) => {
    generateJson.mockRejectedValueOnce(aiDown());
    await expect(call()).rejects.toBeInstanceOf(AiUnavailableError);
  });

  test('screenCV returns real AI output when Gemini succeeds', async () => {
    const payload = {
      ai_score: 87,
      confidence: 0.9,
      recommendation: 'shortlist',
      narrative_summary: 'Strong fit.',
      score_breakdown: { skills_match: 90, experience: 85, communication: 88, culture_fit: 84 },
    };
    generateJson.mockResolvedValueOnce(payload);
    await expect(gemini.screenCV({ candidate_name: 'A', job_title: 'B' })).resolves.toEqual(payload);
  });
});

describe('HR controller — AI outage degrades gracefully (no fake scores)', () => {
  test('createReport saves ai_status=failed with NULL AI fields and returns 201 + warning', async () => {
    generateJson.mockRejectedValueOnce(aiDown());
    supabase.__api.single.mockResolvedValueOnce({
      data: { id: 'r1', ai_score: null, ai_status: 'failed' },
      error: null,
    });

    const req = mockReq({ body: { candidate_name: 'Jane Doe', job_title: 'Engineer' } });
    const res = mockRes();
    await hr.createReport(req, res, jest.fn());

    // Inserted row: no fake scores, failed status
    const inserted = supabase.__api.insert.mock.calls[0][0];
    expect(inserted).toMatchObject({
      ai_score: null,
      confidence: null,
      recommendation: null,
      narrative_summary: null,
      score_breakdown: null,
      ai_status: 'failed',
    });

    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.warning).toMatch(/unavailable/i);
    expect(body.ai_analysis).toBeNull();
    expect(notifyN8n).not.toHaveBeenCalled();
  });

  test('createReport saves ai_status=completed with real AI output when Gemini works', async () => {
    generateJson.mockResolvedValueOnce({
      ai_score: 70,
      confidence: 0.8,
      recommendation: 'review',
      narrative_summary: 'ok',
      score_breakdown: { skills_match: 70, experience: 70, communication: 70, culture_fit: 70 },
    });
    supabase.__api.single.mockResolvedValueOnce({
      data: { id: 'r2', ai_score: 70, ai_status: 'completed' },
      error: null,
    });

    const req = mockReq({ body: { candidate_name: 'John', job_title: 'PM' } });
    const res = mockRes();
    await hr.createReport(req, res, jest.fn());

    expect(supabase.__api.insert.mock.calls[0][0]).toMatchObject({ ai_score: 70, ai_status: 'completed' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].warning).toBeUndefined();
  });

  test('retryAnalysis re-runs AI and updates the row to ai_status=completed', async () => {
    // 1st single(): fetch existing report; 2nd single(): update result
    supabase.__api.single
      .mockResolvedValueOnce({
        data: { id: 'r1', candidate_name: 'Jane', job_title: 'Engineer', extracted_profile: null },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'r1', ai_score: 91, ai_status: 'completed' },
        error: null,
      });
    generateJson.mockResolvedValueOnce({
      ai_score: 91,
      confidence: 0.95,
      recommendation: 'shortlist',
      narrative_summary: 'great',
      score_breakdown: { skills_match: 92, experience: 90, communication: 91, culture_fit: 89 },
    });

    const req = mockReq({ params: { id: 'r1' } });
    const res = mockRes();
    await hr.retryAnalysis(req, res, jest.fn());

    expect(supabase.__api.update).toHaveBeenCalledWith(
      expect.objectContaining({ ai_score: 91, ai_status: 'completed' })
    );
    expect(res.json.mock.calls[0][0].message).toMatch(/re-run/i);
  });

  test('retryAnalysis returns 503 (and keeps ai_status=failed) when AI is still down', async () => {
    supabase.__api.single.mockResolvedValueOnce({
      data: { id: 'r1', candidate_name: 'Jane', job_title: 'Engineer', extracted_profile: null },
      error: null,
    });
    generateJson.mockRejectedValueOnce(aiDown());

    const req = mockReq({ params: { id: 'r1' } });
    const res = mockRes();
    await hr.retryAnalysis(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    expect(supabase.__api.update).toHaveBeenCalledWith(expect.objectContaining({ ai_status: 'failed' }));
  });
});

describe('Support controller — AI outage degrades gracefully', () => {
  test('createTicket saves ai_status=failed with NULL AI fields, escalated=false, 201 + warning', async () => {
    generateJson.mockRejectedValueOnce(aiDown());
    supabase.__api.single.mockResolvedValueOnce({
      data: { id: 't1', ai_status: 'failed', escalated: false },
      error: null,
    });

    const req = mockReq({ body: { query: 'My invoice is wrong and I am furious!' } });
    const res = mockRes();
    await support.createTicket(req, res, jest.fn());

    expect(supabase.__api.insert.mock.calls[0][0]).toMatchObject({
      ai_response: null,
      intent: null,
      urgency: null,
      sentiment: null,
      confidence: null,
      escalated: false,
      ai_status: 'failed',
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].warning).toMatch(/unavailable/i);
    expect(notifyN8n).not.toHaveBeenCalled();
  });

  test('non-AI errors are NOT swallowed (passed to next)', async () => {
    generateJson.mockResolvedValueOnce({
      sentiment: 'neutral', urgency: 'low', intent: 'x', confidence: 0.5, ai_response: 'y',
    });
    supabase.__api.single.mockResolvedValueOnce({ data: null, error: new Error('db down') });

    const next = jest.fn();
    await support.createTicket(mockReq({ body: { query: 'hello there' } }), mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
