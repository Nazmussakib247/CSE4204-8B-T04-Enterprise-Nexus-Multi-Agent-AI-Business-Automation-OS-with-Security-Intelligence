const { query } = require('../config/db');

const AnalyticsModel = {
  create: async (data) => {
    const { rows } = await query(
      `INSERT INTO analytics_reports
         (user_id, task_id, date_period_start, date_period_end,
          performance_rating, overall_score, ai_insights, action_items, kpi_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        data.userId, data.taskId, data.datePeriodStart, data.datePeriodEnd,
        data.performanceRating, data.overallScore, data.aiInsights,
        JSON.stringify(data.actionItems || []),
        JSON.stringify(data.kpiSnapshot || {}),
      ]
    );
    return rows[0];
  },

  findByUser: async (userId, { offset = 0, limit = 20 } = {}) => {
    const { rows } = await query(
      `SELECT * FROM analytics_reports WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    const { rows: cnt } = await query(
      'SELECT COUNT(*) FROM analytics_reports WHERE user_id = $1', [userId]
    );
    return { data: rows, total: parseInt(cnt[0].count) };
  },

  /**
   * Live KPI: aggregate from tasks, finance, support, hr in the last N days.
   */
  liveKpi: async (userId, days = 30) => {
    const [tasks, finance, support, hr] = await Promise.all([
      query(
        `SELECT COUNT(*) AS total, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed
         FROM tasks WHERE user_id = $1 AND created_at >= NOW() - ($2 || ' days')::INTERVAL`,
        [userId, days]
      ),
      query(
        `SELECT COALESCE(SUM(amount),0) AS total_spend,
                COUNT(*) FILTER (WHERE severity IN ('high','critical')) AS anomalies
         FROM finance_records WHERE user_id = $1 AND date >= CURRENT_DATE - $2`,
        [userId, days]
      ),
      query(
        `SELECT COUNT(*) AS total_tickets,
                COUNT(*) FILTER (WHERE status='resolved') AS resolved
         FROM support_tickets WHERE user_id = $1 AND created_at >= NOW() - ($2 || ' days')::INTERVAL`,
        [userId, days]
      ),
      query(
        `SELECT COUNT(*) AS cvs_screened, AVG(ai_score) AS avg_score
         FROM hr_reports WHERE user_id = $1 AND created_at >= NOW() - ($2 || ' days')::INTERVAL`,
        [userId, days]
      ),
    ]);
    return {
      period_days:    days,
      tasks:          tasks.rows[0],
      finance:        finance.rows[0],
      support:        support.rows[0],
      hr:             hr.rows[0],
    };
  },

  /**
   * Six-month trend (one data point per month).
   */
  sixMonthTrend: async (userId) => {
    const { rows } = await query(
      `SELECT DATE_TRUNC('month', created_at) AS month,
              AVG(overall_score) AS avg_score,
              COUNT(*) AS report_count
       FROM analytics_reports
       WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '6 months'
       GROUP BY month ORDER BY month`,
      [userId]
    );
    return rows;
  },
};

module.exports = AnalyticsModel;
