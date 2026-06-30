const { query } = require('../config/db');
const logger   = require('./logger');

const INPUT_COST  = parseFloat(process.env.GEMINI_INPUT_COST_PER_1K  || '0.00035');
const OUTPUT_COST = parseFloat(process.env.GEMINI_OUTPUT_COST_PER_1K || '0.00105');
const BUDGET      = parseFloat(process.env.MONTHLY_BUDGET_USD        || '50');

/**
 * Record token usage and compute USD cost.
 */
const record = async ({ userId, agentType, taskId, inputTokens, outputTokens }) => {
  const costUsd =
    (inputTokens  / 1000) * INPUT_COST +
    (outputTokens / 1000) * OUTPUT_COST;

  try {
    await query(
      `INSERT INTO token_stats
         (user_id, agent_type, task_id, input_tokens, output_tokens, cost_usd)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId || null, agentType, taskId || null, inputTokens, outputTokens, costUsd]
    );
  } catch (err) {
    logger.warn('Token stat record error', { error: err.message });
  }
  return costUsd;
};

/**
 * Fetch month-to-date totals.
 */
const monthlySummary = async () => {
  const { rows } = await query(`
    SELECT
      COALESCE(SUM(input_tokens),  0) AS total_input_tokens,
      COALESCE(SUM(output_tokens), 0) AS total_output_tokens,
      COALESCE(SUM(cost_usd),      0) AS total_cost_usd
    FROM token_stats
    WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
  `);
  return { ...rows[0], budget_usd: BUDGET, budget_remaining_usd: BUDGET - parseFloat(rows[0].total_cost_usd) };
};

module.exports = { record, monthlySummary };
