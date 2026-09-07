/** Maintained Gemini SDK client for strict JSON responses. */
const { GoogleGenAI } = require('@google/genai');
const logger = require('../utils/logger');
const { AiUnavailableError, AiOutputValidationError } = require('./errors');

const DEFAULTS = { model: 'gemini-3.7-flash', timeoutMs: 45_000, maxRetries: 1, baseBackoffMs: 1000, thinkingLevel: 'low' };
let client;
let configuredKey;

const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new AiUnavailableError('GEMINI_API_KEY is not configured', { reason: 'not_configured' });
  if (!client || configuredKey !== apiKey) {
    client = new GoogleGenAI({ apiKey });
    configuredKey = apiKey;
  }
  return client;
};
const getModelName = () => process.env.GEMINI_MODEL?.trim() || DEFAULTS.model;
const getTimeoutMs = () => Number(process.env.AI_TIMEOUT_MS) || DEFAULTS.timeoutMs;
const getMaxRetries = () => Number.isInteger(Number(process.env.AI_MAX_RETRIES)) ? Math.max(0, Math.min(2, Number(process.env.AI_MAX_RETRIES))) : DEFAULTS.maxRetries;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isTransient = (err) => {
  if (err?.reason === 'timeout') return true;
  const status = err?.status ?? err?.response?.status;
  return status === 429 || (status >= 500 && status < 600) || /429|rate limit|quota|ECONNRESET|ETIMEDOUT|ENOTFOUND|fetch failed|503|500|overloaded|unavailable/i.test(String(err?.message || ''));
};
const reasonFor = (err) => {
  if (err?.reason === 'timeout') return 'timeout';
  const status = err?.status ?? err?.response?.status;
  return status === 429 || /429|rate limit|quota/i.test(String(err?.message || '')) ? 'rate_limit' : 'api_error';
};
const withTimeout = async (promise, timeoutMs) => {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_resolve, reject) => {
      timer = setTimeout(() => { const err = new Error(`Gemini call timed out after ${timeoutMs}ms`); err.reason = 'timeout'; reject(err); }, timeoutMs);
    })]);
  } finally { clearTimeout(timer); }
};

async function generateJson({ prompt, responseSchema, systemInstruction, timeoutMs = getTimeoutMs(), maxRetries = getMaxRetries(), thinkingLevel = process.env.GEMINI_THINKING_LEVEL?.trim() || DEFAULTS.thinkingLevel }) {
  let lastErr;
  const attempts = maxRetries + 1;
  let attempted = 0;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    attempted = attempt;
    try {
      const result = await withTimeout(getClient().models.generateContent({
        model: getModelName(), contents: prompt,
        config: {
          ...(systemInstruction ? { systemInstruction } : {}),
          responseMimeType: 'application/json',
          ...(responseSchema ? { responseJsonSchema: responseSchema } : {}),
          ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
        },
      }), timeoutMs);
      const text = typeof result.text === 'function' ? result.text() : result.text;
      try { return JSON.parse(text); }
      catch (cause) { throw new AiOutputValidationError(`Gemini returned non-JSON output: ${cause.message}`, { cause, attempts: attempt }); }
    } catch (err) {
      lastErr = err;
      if (err instanceof AiOutputValidationError || !isTransient(err) || attempt === attempts) break;
      const backoffMs = DEFAULTS.baseBackoffMs * 2 ** (attempt - 1) + Math.random() * 250;
      logger.warn('[AI] Gemini attempt failed, retrying', { attempt, backoffMs: Math.round(backoffMs), reason: reasonFor(err), error: err.message });
      await sleep(backoffMs);
    }
  }
  if (lastErr instanceof AiUnavailableError) throw lastErr;
  throw new AiUnavailableError(`Gemini unavailable: ${lastErr?.message || 'unknown error'}`, { cause: lastErr, reason: reasonFor(lastErr), attempts: attempted });
}

module.exports = { generateJson, getModelName, getTimeoutMs, getMaxRetries, DEFAULTS, AiUnavailableError };
