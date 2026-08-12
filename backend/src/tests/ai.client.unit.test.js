/**
 * Unit tests for the hardened Gemini client (src/ai/client.js).
 * Mocks the @google/generative-ai SDK — no network calls.
 */

jest.mock('@google/generative-ai', () => {
  const generateContent = jest.fn();
  const getGenerativeModel = jest.fn(() => ({ generateContent }));
  const GoogleGenerativeAI = jest.fn(() => ({ getGenerativeModel }));
  return { GoogleGenerativeAI, __mock: { generateContent, getGenerativeModel } };
});

jest.mock('../utils/logger', () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn() }));

const { __mock } = require('@google/generative-ai');

const okResponse = (obj) => ({ response: { text: () => JSON.stringify(obj) } });
const transientError = () => Object.assign(new Error('503 Service Unavailable'), { status: 503 });

// client.js reads env (model, timeout, api key) at call time, so a single
// module load is fine — no resetModules needed.
const loadClient = () => require('../ai/client');

describe('ai/client generateJson', () => {
  const SCHEMA = { type: 'object', properties: { ok: { type: 'boolean' } } };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
    delete process.env.GEMINI_MODEL;
    delete process.env.AI_TIMEOUT_MS;
  });

  test('returns parsed JSON on success (native JSON mode config sent)', async () => {
    __mock.generateContent.mockResolvedValueOnce(okResponse({ ok: true }));
    const { generateJson } = loadClient();

    const result = await generateJson({ prompt: 'hi', responseSchema: SCHEMA });

    expect(result).toEqual({ ok: true });
    expect(__mock.getGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-1.5-flash', // default from env fallback
        generationConfig: expect.objectContaining({
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
        }),
      })
    );
  });

  test('uses GEMINI_MODEL from env when set', async () => {
    process.env.GEMINI_MODEL = 'gemini-2.0-flash';
    __mock.generateContent.mockResolvedValueOnce(okResponse({ ok: true }));
    const { generateJson } = loadClient();

    await generateJson({ prompt: 'hi', responseSchema: SCHEMA });

    expect(__mock.getGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-2.0-flash' })
    );
  });

  test('retries transient errors with backoff and succeeds (2 failures + 1 success = 3 attempts)', async () => {
    __mock.generateContent
      .mockRejectedValueOnce(transientError())
      .mockRejectedValueOnce(transientError())
      .mockResolvedValueOnce(okResponse({ ok: true }));
    const { generateJson } = loadClient();

    const result = await generateJson({ prompt: 'hi', responseSchema: SCHEMA });

    expect(result).toEqual({ ok: true });
    expect(__mock.generateContent).toHaveBeenCalledTimes(3);
  }, 15000);

  test('gives up after maxRetries and throws AiUnavailableError', async () => {
    __mock.generateContent.mockRejectedValue(transientError());
    const { generateJson, AiUnavailableError } = loadClient();

    await expect(generateJson({ prompt: 'hi', responseSchema: SCHEMA })).rejects.toBeInstanceOf(
      AiUnavailableError
    );
    // maxRetries = 2 → exactly 3 attempts, no more
    expect(__mock.generateContent).toHaveBeenCalledTimes(3);
  }, 15000);

  test('does NOT retry non-transient errors (e.g. 400 bad request)', async () => {
    __mock.generateContent.mockRejectedValue(
      Object.assign(new Error('400 Bad Request: invalid argument'), { status: 400 })
    );
    const { generateJson, AiUnavailableError } = loadClient();

    await expect(generateJson({ prompt: 'hi', responseSchema: SCHEMA })).rejects.toBeInstanceOf(
      AiUnavailableError
    );
    expect(__mock.generateContent).toHaveBeenCalledTimes(1);
  });

  test('times out a hung call and reports reason=timeout', async () => {
    __mock.generateContent.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(okResponse({ ok: true })), 5000))
    );
    const { generateJson, AiUnavailableError } = loadClient();

    const started = Date.now();
    await expect(
      generateJson({ prompt: 'hi', responseSchema: SCHEMA, timeoutMs: 100, maxRetries: 0 })
    ).rejects.toMatchObject({ name: 'AiUnavailableError', reason: 'timeout' });
    expect(Date.now() - started).toBeLessThan(3000);

    await expect(
      generateJson({ prompt: 'hi', responseSchema: SCHEMA, timeoutMs: 100, maxRetries: 0 })
    ).rejects.toBeInstanceOf(AiUnavailableError);
  });

  test('timeout is retried as a transient error', async () => {
    __mock.generateContent
      .mockImplementationOnce(() => new Promise((resolve) => setTimeout(resolve, 5000)))
      .mockResolvedValueOnce(okResponse({ ok: true }));
    const { generateJson } = loadClient();

    const result = await generateJson({
      prompt: 'hi',
      responseSchema: SCHEMA,
      timeoutMs: 100,
      maxRetries: 1,
    });

    expect(result).toEqual({ ok: true });
    expect(__mock.generateContent).toHaveBeenCalledTimes(2);
  });

  test('non-JSON output throws AiOutputValidationError and is NOT retried', async () => {
    __mock.generateContent.mockResolvedValue({ response: { text: () => 'not json at all' } });
    const { generateJson } = loadClient();

    await expect(generateJson({ prompt: 'hi', responseSchema: SCHEMA })).rejects.toMatchObject({
      name: 'AiOutputValidationError',
      reason: 'invalid_output',
    });
    expect(__mock.generateContent).toHaveBeenCalledTimes(1);
  });

  test('throws AiUnavailableError(not_configured) when GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    const { generateJson } = loadClient();

    await expect(generateJson({ prompt: 'hi', responseSchema: SCHEMA })).rejects.toMatchObject({
      name: 'AiUnavailableError',
      reason: 'not_configured',
    });
    expect(__mock.generateContent).not.toHaveBeenCalled();
  });
});
