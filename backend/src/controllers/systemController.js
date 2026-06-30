const { ping }        = require('../config/db');
const tokenTracker    = require('../utils/tokenTracker');
const aiCache         = require('../utils/aiCache');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { success, error } = require('../utils/response');

/** GET /api/system/health — liveness */
const healthLive = (req, res) => res.json({ status: 'ok', uptime: process.uptime() });

/**
 * GET /api/system/health/deep
 * Check DB + AI reachability.
 */
const healthDeep = async (req, res) => {
  const checks = { db: false, ai: false, cache: true };

  try { await ping(); checks.db = true; } catch {}

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    await model.generateContent('ping');
    checks.ai = true;
  } catch {}

  const allOk  = Object.values(checks).every(Boolean);
  const status = allOk ? 200 : 503;
  return res.status(status).json({ success: allOk, checks });
};

/** GET /api/system/tokens — monthly token and cost summary */
const getTokenStats = async (req, res) => {
  const summary = await tokenTracker.monthlySummary();
  return success(res, { summary });
};

/** DELETE /api/system/cache — evict expired AI cache entries */
const evictCache = async (req, res) => {
  await aiCache.evict();
  return success(res, {}, 'Cache eviction complete');
};

module.exports = { healthLive, healthDeep, getTokenStats, evictCache };
