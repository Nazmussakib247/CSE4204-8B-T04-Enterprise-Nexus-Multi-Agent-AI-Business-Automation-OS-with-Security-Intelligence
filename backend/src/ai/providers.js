const crypto = require('crypto');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { GoogleGenAI } = require('@google/genai');
const { AiUnavailableError, AiOutputValidationError } = require('./errors');

let cached = null;
let cachedAt = 0;
const CACHE_MS = 30_000;
const key = () => crypto.createHash('sha256').update(process.env.AI_CONFIG_ENCRYPTION_KEY || process.env.JWT_SECRET).digest();
const encrypt = (value) => {
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  return `${iv.toString('base64')}.${Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]).toString('base64')}.${cipher.getAuthTag().toString('base64')}`;
};
const decrypt = (value) => {
  try { const [iv, body, tag] = value.split('.').map((p) => Buffer.from(p, 'base64')); const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv); decipher.setAuthTag(tag); return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8'); } catch { return null; }
};
const envConfig = () => ([
  { provider: 'gemini', enabled: Boolean(process.env.GEMINI_API_KEY), priority: 1, apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' },
  { provider: 'groq', enabled: Boolean(process.env.GROQ_API_KEY), priority: 2, apiKey: process.env.GROQ_API_KEY, model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b' },
]);
async function getProviders() {
  if (cached && Date.now() - cachedAt < CACHE_MS) return cached;
  const defaults = envConfig();
  const { data, error } = await supabase.from('ai_provider_settings').select('provider,enabled,priority,api_key_ciphertext,model');
  if (error) { logger.warn('[AI] Provider settings unavailable; using environment configuration', { error: error.message }); return defaults; }
  cached = defaults.map((base) => { const row = data.find((item) => item.provider === base.provider); const stored = row?.api_key_ciphertext ? decrypt(row.api_key_ciphertext) : null; return { ...base, ...row, apiKey: stored || base.apiKey, enabled: Boolean(row ? row.enabled : base.enabled) }; }).filter((item) => item.enabled && item.apiKey).sort((a,b) => a.priority - b.priority);
  cachedAt = Date.now(); return cached;
}
const publicSettings = async () => {
  const env = envConfig(); const { data, error } = await supabase.from('ai_provider_settings').select('provider,enabled,priority,api_key_ciphertext,model,updated_at');
  if (error) return env.map(({ apiKey, ...item }) => ({ ...item, configured: Boolean(apiKey), source: 'environment' }));
  return env.map((base) => { const row = data.find((item) => item.provider === base.provider); return { provider: base.provider, enabled: row ? row.enabled : base.enabled, priority: row?.priority ?? base.priority, model: row?.model || base.model, configured: Boolean(row?.api_key_ciphertext || base.apiKey), updated_at: row?.updated_at || null }; });
};
async function saveProviders(items, userId) {
  const existing = await publicSettings();
  const next = existing.map((current) => ({ ...current, ...(items.find((item) => item.provider === current.provider) || {}) }));
  if (!next.some((item) => item.enabled && (item.configured || item.api_key))) { const err = new Error('At least one configured AI provider must remain enabled'); err.statusCode = 400; throw err; }
  for (const item of items) {
    const payload = { provider: item.provider, enabled: Boolean(item.enabled), priority: Number(item.priority), model: item.model || null, updated_by: userId, updated_at: new Date().toISOString() };
    if (item.api_key) payload.api_key_ciphertext = encrypt(item.api_key.trim());
    const { error } = await supabase.from('ai_provider_settings').upsert(payload, { onConflict: 'provider' }); if (error) throw error;
  }
  cached = null; return publicSettings();
}
async function generate(provider, { prompt, systemInstruction, responseSchema, timeoutMs }) {
  if (provider.provider === 'gemini') {
    const result = await withTimeout(new GoogleGenAI({ apiKey: provider.apiKey }).models.generateContent({ model: provider.model, contents: prompt, config: { ...(systemInstruction ? { systemInstruction } : {}), responseMimeType: 'application/json', ...(responseSchema ? { responseJsonSchema: responseSchema } : {}), thinkingConfig: { thinkingLevel: 'low' } } }), timeoutMs, 'Gemini'); return JSON.parse(typeof result.text === 'function' ? result.text() : result.text);
  }
  if (provider.provider !== 'groq') throw new Error(`Unsupported AI provider: ${provider.provider}`);
  const response = await withTimeout(fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` }, body: JSON.stringify({ model: provider.model, temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: `${systemInstruction || 'Return strict JSON only.'}\nReturn JSON matching this schema: ${JSON.stringify(responseSchema || {})}` }, { role: 'user', content: prompt }] }) }), timeoutMs, 'Groq');
  if (!response.ok) throw new Error(`Groq HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`); const body = await response.json(); return JSON.parse(body.choices?.[0]?.message?.content || '');
}
async function withTimeout(promise, ms, name) { let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${name} timed out after ${ms}ms`)), ms); })]); } finally { clearTimeout(timer); } }
async function generateJsonWithFailover(opts) {
  const providers = [...await getProviders()]; if (!providers.length) throw new AiUnavailableError('No enabled AI provider is configured', { reason: 'not_configured' });
  if (opts.preferProvider) providers.sort((a, b) => (a.provider === opts.preferProvider ? -1 : b.provider === opts.preferProvider ? 1 : 0));
  let lastError; for (const provider of providers) { try { const value = await generate(provider, opts); if (!value || typeof value !== 'object') throw new AiOutputValidationError(`${provider.provider} returned invalid JSON`); return value; } catch (error) { lastError = error; logger.warn('[AI] Provider failed; trying next provider', { provider: provider.provider, error: error.message }); } }
  throw new AiUnavailableError(`All AI providers failed: ${lastError?.message || 'unknown error'}`, { cause: lastError, reason: 'api_error' });
}
module.exports = { generateJsonWithFailover, publicSettings, saveProviders };
