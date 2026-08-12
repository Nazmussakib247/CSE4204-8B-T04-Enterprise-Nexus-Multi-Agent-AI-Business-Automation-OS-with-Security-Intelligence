/**
 * Hardened Gemini client.
 *
 * - Model name from env (GEMINI_MODEL, default gemini-1.5-flash)
 * - Hard timeout per attempt (AI_TIMEOUT_MS, default 30s)
 * - 2 retries with exponential backoff + jitter (retries only transient errors)
 * - Native JSON mode via generationConfig.responseMimeType + responseSchema —
 *   the model returns strict JSON, no markdown code-fence stripping needed.
 *
 * All failures surface as a typed AiUnavailableError so callers never have to
 * invent fallback data.
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');
const { AiUnavailableError, AiOutputValidationError } = require('./errors');

const DEFAULTS = {
  model: 'gemini-1.5-flash',
  timeoutMs: 30_000,
  maxRetries: 2, // 2 retries => up to 3 attempts
  baseBackoffMs: 500,
};

let _genAI = null;
const getGenAI = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new AiUnavailableError('GEMINI_API_KEY is not configured', { reason: 'not_configured' });
  }
  if (!_genAI) _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return _genAI;
};

const getModelName = () => process.env.GEMINI_MODEL || DEFAULTS.model;
const getTimeoutMs = () => Number(process.env.AI_TIMEOUT_MS) || DEFAULTS.timeoutMs;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Errors worth retrying: timeouts, rate limits, 5xx / network hiccups. */
const isTransient = (err) => {
  if (err && err.reason === 'timeout') return true;
  const status = err?.status ?? err?.response?.status;
  if (status === 429 || (status >= 500 && status < 600)) return true;
  const msg = String(err?.message || '');
  return /429|rate limit|quota|ECONNRESET|ETIMEDOUT|ENOTFOUND|fetch failed|503|500|overloaded|unavailable/i.test(msg);
};

const withTimeout = async (promise, ms) => {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => {
          const e = new Error(`Gemini call timed out after ${ms}ms`);
          e.reason = 'timeout';
          reject(e);
        }, ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Call Gemini in native JSON mode and return the parsed object.
 *
 * @param {object} opts
 * @param {string} opts.prompt             user prompt
 * @param {object} opts.responseSchema     Gemini response schema (OpenAPI-style)
 * @param {string} [opts.systemInstruction]
 * @param {number} [opts.timeoutMs]        override per-attempt timeout
 * @param {number} [opts.maxRetries]       override retry count
 * @returns {Promise<object>} parsed JSON object
 * @throws {AiUnavailableError}
 */
async function generateJson({
  prompt,
  responseSchema,
  systemInstruction,
  timeoutMs = getTimeoutMs(),
  maxRetries = DEFAULTS.maxRetries,
}) {
  const model = getGenAI().getGenerativeModel({
    model: getModelName(),
    ...(systemInstruction ? { systemInstruction } : {}),
    generationConfig: {
      responseMimeType: 'application/json',
      ...(responseSchema ? { responseSchema } : {}),
    },
  });

  let lastErr;
  const attempts = maxRetries + 1;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const result = await withTimeout(model.generateContent(prompt), timeoutMs);
      const text = result.response.text();
      try {
        return JSON.parse(text);
      } catch (parseErr) {
        throw new AiOutputValidationError(`Gemini returned non-JSON output: ${parseErr.message}`, {
          cause: parseErr,
          attempts: attempt,
        });
      }
    } catch (err) {
      lastErr = err;
      // Invalid output and non-transient API errors are not retried.
      if (err instanceof AiOutputValidationError) throw err;
      if (!isTransient(err) || attempt === attempts) break;

      const backoff = DEFAULTS.baseBackoffMs * 2 ** (attempt - 1) + Math.random() * 100;
      logger.warn('[AI] Gemini attempt failed, retrying', {
        attempt,
        backoffMs: Math.round(backoff),
        error: err.message,
      });
      await sleep(backoff);
    }
  }

  if (lastErr instanceof AiUnavailableError) throw lastErr;
  throw new AiUnavailableError(`Gemini unavailable: ${lastErr?.message || 'unknown error'}`, {
    cause: lastErr,
    reason: lastErr?.reason === 'timeout' ? 'timeout' : 'api_error',
    attempts,
  });
}

module.exports = { generateJson, getModelName, getTimeoutMs, DEFAULTS, AiUnavailableError };
