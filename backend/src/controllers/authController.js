const UserModel              = require('../models/User');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');
const { success, error }     = require('../utils/response');

/**
 * POST /api/auth/register
 * Public — register a new employee account.
 */
const register = async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return error(res, 'name, email, and password are required', 400);

  const existing = await UserModel.findByEmail(email);
  if (existing) return error(res, 'Email already registered', 409);

  // Default role: employee
  const roleId = await UserModel.getRoleIdByName('employee');
  if (!roleId) return error(res, 'Default role not found — run migrations', 500);

  const user = await UserModel.create({ name, email, password, roleId });
  return success(res, { user }, 'Registration successful', 201);
};

/**
 * POST /api/auth/login
 * Public — authenticate and receive JWT pair.
 */
const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return error(res, 'email and password are required', 400);

  const user = await UserModel.findByEmail(email);
  if (!user || !user.is_active) return error(res, 'Invalid credentials', 401);

  const valid = await UserModel.comparePassword(password, user.password_hash);
  if (!valid) return error(res, 'Invalid credentials', 401);

  const payload = { sub: user.id, role: user.role };
  const accessToken  = signAccess(payload);
  const refreshToken = signRefresh(payload);

  return success(res, {
    access_token:  accessToken,
    refresh_token: refreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  }, 'Login successful');
};

/**
 * POST /api/auth/refresh
 * Public — exchange refresh token for a new access token.
 */
const refresh = async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return error(res, 'refresh_token is required', 400);

  let payload;
  try { payload = verifyRefresh(refresh_token); }
  catch { return error(res, 'Invalid or expired refresh token', 401); }

  const user = await UserModel.findById(payload.sub);
  if (!user || !user.is_active) return error(res, 'User not found or inactive', 401);

  const accessToken = signAccess({ sub: user.id, role: user.role });
  return success(res, { access_token: accessToken }, 'Token refreshed');
};

module.exports = { register, login, refresh };
