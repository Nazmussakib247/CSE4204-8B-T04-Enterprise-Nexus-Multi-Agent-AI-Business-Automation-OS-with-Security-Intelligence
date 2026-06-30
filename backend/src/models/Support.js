const { query } = require('../config/db');

const SupportModel = {
  create: async (data) => {
    const { rows } = await query(
      `INSERT INTO support_tickets
         (user_id, task_id, text_query, ai_response, intent, urgency, sentiment, confidence, escalated, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'open') RETURNING *`,
      [data.userId, data.taskId, data.textQuery, data.aiResponse,
       data.intent, data.urgency, data.sentiment, data.confidence, data.escalated || false]
    );
    return rows[0];
  },

  findByUser: async (userId, { offset = 0, limit = 20, status } = {}) => {
    const filters = [userId];
    let where = '';
    if (status) { filters.push(status); where += ` AND status = $${filters.length}`; }
    filters.push(limit, offset);
    const { rows } = await query(
      `SELECT * FROM support_tickets WHERE user_id = $1 ${where}
       ORDER BY created_at DESC LIMIT $${filters.length - 1} OFFSET $${filters.length}`,
      filters
    );
    const { rows: cnt } = await query(
      'SELECT COUNT(*) FROM support_tickets WHERE user_id = $1', [userId]
    );
    return { data: rows, total: parseInt(cnt[0].count) };
  },

  findById: async (id) => {
    const { rows } = await query('SELECT * FROM support_tickets WHERE id = $1', [id]);
    return rows[0] || null;
  },

  updateStatus: async (id, userId, status) => {
    const { rows } = await query(
      `UPDATE support_tickets SET status = $3
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId, status]
    );
    return rows[0] || null;
  },
};

module.exports = SupportModel;
