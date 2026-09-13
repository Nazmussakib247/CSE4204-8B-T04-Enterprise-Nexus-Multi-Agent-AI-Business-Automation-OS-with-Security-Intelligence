jest.mock('@google/genai', () => {
  const generateContent = jest.fn();
  const GoogleGenAI = jest.fn(() => ({ models: { generateContent } }));
  return { GoogleGenAI, __mock: { generateContent, GoogleGenAI } };
});
jest.mock('../utils/logger', () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn() }));

const { __mock } = require('@google/genai');
const ok = (value) => ({ text: JSON.stringify(value) });
const unavailable = () => Object.assign(new Error('503 Service Unavailable'), { status: 503 });

describe('ai/client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_THINKING_LEVEL;
    delete process.env.AI_MAX_RETRIES;
  });

  test('uses maintained SDK with Gemini 3.7 JSON and low-thinking config', async () => {
    __mock.generateContent.mockResolvedValueOnce(ok({ ok: true }));
    const { generateJson } = require('../ai/client');
    await expect(generateJson({ prompt: 'hi', responseSchema: { type: 'object' } })).resolves.toEqual({ ok: true });
    expect(__mock.generateContent).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemini-3.7-flash',
      config: expect.objectContaining({ responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'low' } }),
    }));
  });

  test('retries a transient service failure once', async () => {
    __mock.generateContent.mockRejectedValue(unavailable());
    const { generateJson } = require('../ai/client');
    await expect(generateJson({ prompt: 'hi', responseSchema: {} })).rejects.toMatchObject({ reason: 'api_error', attempts: 2 });
    expect(__mock.generateContent).toHaveBeenCalledTimes(2);
  }, 10000);

  test('does not retry an invalid request', async () => {
    __mock.generateContent.mockRejectedValue(Object.assign(new Error('400 invalid request'), { status: 400 }));
    const { generateJson } = require('../ai/client');
    await expect(generateJson({ prompt: 'hi', responseSchema: {} })).rejects.toMatchObject({ reason: 'api_error', attempts: 1 });
    expect(__mock.generateContent).toHaveBeenCalledTimes(1);
  });
});
