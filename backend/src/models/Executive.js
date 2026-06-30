const { query } = require('../config/db');

const ExecutiveModel = {
  create: async (data) => {
    const { rows } = await query(
      `INSERT INTO executive_reports
         (user_id, task_id, date, briefing_text, agent_outputs, performance_summary)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        data.userId, data.taskId, data.date || new Date().toISOString().split('T')[0],
        data.briefingText,
        JSON.stringify(data.agentOutputs || {}),
        JSON.stringify(data.performanceSummary || {}),
      ]
    );
    return rows[0];
  },

  findByUser: async (userId, { offset = 0, limit = 20 } = {}) => {
    const { rows } = await query(
      `SELECT * FROM executive_reports WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    const { rows: cnt } = await query(
      'SELECT COUNT(*) FROM executive_reports WHERE user_id = $1', [userId]
    );
    return { data: rows, total: parseInt(cnt[0].count) };
  },

  findById: async (id) => {
    const { rows } = await query('SELECT * FROM executive_reports WHERE id = $1', [id]);
    return rows[0] || null;
  },
};

module.exports = ExecutiveModel;
