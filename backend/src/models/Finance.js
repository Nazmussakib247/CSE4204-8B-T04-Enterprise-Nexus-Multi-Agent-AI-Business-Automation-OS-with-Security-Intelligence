const { query } = require('../config/db');

const FinanceModel = {
  create: async (data) => {
    const { rows } = await query(
      `INSERT INTO finance_records
         (user_id, category, amount, date, description, severity, ai_analysis)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [data.userId, data.category, data.amount, data.date,
       data.description, data.severity, data.aiAnalysis]
    );
    return rows[0];
  },

  findByUser: async (userId, { offset = 0, limit = 20, category, dateFrom, dateTo } = {}) => {
    const filters = [userId];
    let where = '';
    if (category) { filters.push(category); where += ` AND category = $${filters.length}`; }
    if (dateFrom)  { filters.push(dateFrom); where += ` AND date >= $${filters.length}`; }
    if (dateTo)    { filters.push(dateTo);   where += ` AND date <= $${filters.length}`; }
    filters.push(limit, offset);
    const { rows } = await query(
      `SELECT * FROM finance_records WHERE user_id = $1 ${where}
       ORDER BY date DESC LIMIT $${filters.length - 1} OFFSET $${filters.length}`,
      filters
    );
    const { rows: cnt } = await query(
      'SELECT COUNT(*) FROM finance_records WHERE user_id = $1', [userId]
    );
    return { data: rows, total: parseInt(cnt[0].count) };
  },

  /**
   * Aggregated dashboard summary: total spend per category, anomaly counts, trend.
   */
  dashboardSummary: async (userId) => {
    const { rows: byCategory } = await query(
      `SELECT category,
              SUM(amount)  AS total,
              COUNT(*)     AS count,
              MAX(severity) AS max_severity
       FROM finance_records WHERE user_id = $1
       GROUP BY category ORDER BY total DESC`,
      [userId]
    );
    const { rows: anomalies } = await query(
      `SELECT COUNT(*) AS high_severity_count
       FROM finance_records
       WHERE user_id = $1 AND severity IN ('high', 'critical')`,
      [userId]
    );
    const { rows: monthly } = await query(
      `SELECT DATE_TRUNC('month', date) AS month,
              SUM(amount) AS total
       FROM finance_records WHERE user_id = $1
       GROUP BY month ORDER BY month`,
      [userId]
    );
    return {
      by_category:        byCategory,
      high_severity_count: parseInt(anomalies[0].high_severity_count),
      monthly_trend:       monthly,
    };
  },
};

module.exports = FinanceModel;
