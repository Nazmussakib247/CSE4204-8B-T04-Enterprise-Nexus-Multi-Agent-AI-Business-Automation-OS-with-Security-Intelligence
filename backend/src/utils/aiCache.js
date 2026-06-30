const crypto = require('crypto');
const { query } = require('../config/db');
const logger   = require('./logger');

const TTL = parseInt(process.env.AI_CACHE_TTL || '3600'); // seconds

/**
 * Derive a deterministic cache key from the prompt string.
 */
const makeKey = (prompt) =>
  crypto.createHash('sha256').update(prompt).digest('hex');

/**
 * Retrieve a cached response. Returns null on miss.
 */
const get = async (prompt, agentType) => {
  const key = makeKey(prompt);
  try {
    const { rows } = await query(
      `SELECT response FROM ai_cache
       WHERE cache_key = $1 AND expires_at > NOW()`,
      [key]
    );
    if (rows.length) {
      await query('UPDATE ai_cache SET hit_count = hit_count + 1 WHERE cache_key = $1', [key]);
      logger.debug('AI cache HIT', { agentType, key: key.slice(0, 8) });
      return rows[0].response;
    }
  } catch (err) {
    logger.warn('AI cache get error', { error: err.message });
  }
  return null;
};

/**
 * Store a response in cache.
 */
const set = async (prompt, response, agentType) => {
  const key = makeKey(prompt);
  try {
    await query(
      `INSERT INTO ai_cache (cache_key, response, agent_type, expires_at)
       VALUES ($1, $2, $3, NOW() + ($4 || ' seconds')::INTERVAL)
       ON CONFLICT (cache_key) DO UPDATE
         SET response = EXCLUDED.response,
             expires_at = EXCLUDED.expires_at`,
      [key, response, agentType, TTL]
    );
  } catch (err) {
    logger.warn('AI cache set error', { error: err.message });
  }
};

/**
 * Evict expired entries (run periodically).
 */
const evict = async () => {
  const { rowCount } = await query('DELETE FROM ai_cache WHERE expires_at < NOW()');
  logger.info(`AI cache evicted ${rowCount} expired entries`);
};

module.exports = { get, set, evict };
