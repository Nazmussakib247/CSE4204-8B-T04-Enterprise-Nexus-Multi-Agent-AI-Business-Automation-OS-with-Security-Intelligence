const { verifyAccess } = require('../utils/jwt');
const { error }        = require('../utils/response');
const { query }        = require('../config/db');

/**
 * Verify Bearer token and attach user + role to req.
 */
const authenticate = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return error(res, 'Authentication required', 401);
  }

  const token = auth.split(' ')[1];
  let payload;
  try {
    payload = verifyAccess(token);
  } catch {
    return error(res, 'Invalid or expired token', 401);
  }

  // Refresh user from DB to catch deactivation mid-session
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.is_active, r.name AS role
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [payload.sub]
  );

  if (!rows.length || !rows[0].is_active) {
    return error(res, 'Account not found or deactivated', 401);
  }

  req.user = rows[0];
  next();
};

/**
 * Factory — restrict route to one or more roles.
 * Usage: authorize('admin')  or  authorize('admin', 'employee')
 */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return error(res, 'Not authenticated', 401);
  if (!roles.includes(req.user.role)) return error(res, 'Forbidden', 403);
  next();
};

module.exports = { authenticate, authorize };
