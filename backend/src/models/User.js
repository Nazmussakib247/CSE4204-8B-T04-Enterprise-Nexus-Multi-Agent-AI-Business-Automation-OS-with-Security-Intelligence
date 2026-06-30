const { query } = require('../config/db');
const bcrypt    = require('bcryptjs');

const SALT_ROUNDS = 12;

const UserModel = {
  /**
   * Find user by email (for login).
   */
  findByEmail: async (email) => {
    const { rows } = await query(
      `SELECT u.*, r.name AS role
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.email = $1`,
      [email]
    );
    return rows[0] || null;
  },

  findById: async (id) => {
    const { rows } = await query(
      `SELECT u.id, u.name, u.email, u.is_active, u.created_at, u.updated_at, r.name AS role
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * List all users (admin).
   */
  findAll: async ({ offset = 0, limit = 20 } = {}) => {
    const { rows } = await query(
      `SELECT u.id, u.name, u.email, u.is_active, u.created_at, r.name AS role
       FROM users u JOIN roles r ON r.id = u.role_id
       ORDER BY u.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const { rows: cnt } = await query('SELECT COUNT(*) FROM users');
    return { data: rows, total: parseInt(cnt[0].count) };
  },

  create: async ({ name, email, password, roleId }) => {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, role_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, is_active, created_at`,
      [name, email, hash, roleId]
    );
    return rows[0];
  },

  update: async (id, { name, email, roleId, isActive }) => {
    const { rows } = await query(
      `UPDATE users
       SET name      = COALESCE($2, name),
           email     = COALESCE($3, email),
           role_id   = COALESCE($4, role_id),
           is_active = COALESCE($5, is_active),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, email, is_active, updated_at`,
      [id, name, email, roleId, isActive]
    );
    return rows[0] || null;
  },

  updatePassword: async (id, newPassword) => {
    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await query(
      'UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1',
      [id, hash]
    );
  },

  delete: async (id) => {
    const { rowCount } = await query('DELETE FROM users WHERE id = $1', [id]);
    return rowCount > 0;
  },

  comparePassword: async (plain, hash) => bcrypt.compare(plain, hash),

  getRoleIdByName: async (name) => {
    const { rows } = await query('SELECT id FROM roles WHERE name = $1', [name]);
    return rows[0]?.id || null;
  },
};

module.exports = UserModel;
