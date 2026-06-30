const { query } = require('../config/db');

const TaskModel = {
  create: async ({ userId, agentType, payload, text }) => {
    const { rows } = await query(
      `INSERT INTO tasks (user_id, agent_type, payload, text, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [userId, agentType, JSON.stringify(payload || {}), text || null]
    );
    return rows[0];
  },

  updateStatus: async (id, status, result = null) => {
    const { rows } = await query(
      `UPDATE tasks
       SET status       = $2,
           result       = $3,
           completed_at = CASE WHEN $2 IN ('completed','failed') THEN NOW() ELSE NULL END
       WHERE id = $1
       RETURNING *`,
      [id, status, result ? JSON.stringify(result) : null]
    );
    return rows[0] || null;
  },

  findById: async (id) => {
    const { rows } = await query('SELECT * FROM tasks WHERE id = $1', [id]);
    return rows[0] || null;
  },

  findByUser: async (userId, { offset = 0, limit = 20, agentType } = {}) => {
    const filters = [userId];
    let sql = `SELECT * FROM tasks WHERE user_id = $1`;
    if (agentType) { filters.push(agentType); sql += ` AND agent_type = $${filters.length}`; }
    sql += ` ORDER BY created_at DESC LIMIT $${filters.length + 1} OFFSET $${filters.length + 2}`;
    filters.push(limit, offset);
    const { rows } = await query(sql, filters);
    const { rows: cnt } = await query(
      'SELECT COUNT(*) FROM tasks WHERE user_id = $1',
      [userId]
    );
    return { data: rows, total: parseInt(cnt[0].count) };
  },

  findAll: async ({ offset = 0, limit = 20, agentType, status } = {}) => {
    const filters = [];
    let where = '';
    if (agentType) { filters.push(agentType); where += ` AND agent_type = $${filters.length}`; }
    if (status)    { filters.push(status);    where += ` AND status = $${filters.length}`; }
    filters.push(limit, offset);
    const { rows } = await query(
      `SELECT t.*, u.name AS user_name FROM tasks t
       JOIN users u ON u.id = t.user_id
       WHERE 1=1 ${where}
       ORDER BY t.created_at DESC
       LIMIT $${filters.length - 1} OFFSET $${filters.length}`,
      filters
    );
    return rows;
  },
};

module.exports = TaskModel;
