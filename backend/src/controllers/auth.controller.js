const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const supabase = require('../config/supabase');
const { sendPasswordReset } = require('../utils/email');
const { writeAuditLog } = require('../utils/audit');

// ── Cookie helpers ────────────────────────────────────────────
const IS_PROD = process.env.NODE_ENV === 'production';

const COOKIE_BASE = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: IS_PROD ? 'strict' : 'lax',
  path: '/',
};

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie('accessToken', accessToken, { ...COOKIE_BASE, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', refreshToken, { ...COOKIE_BASE, maxAge: 7 * 24 * 60 * 60 * 1000, path: '/api/auth' });
};

const clearAuthCookies = (res) => {
  res.clearCookie('accessToken', { ...COOKIE_BASE });
  res.clearCookie('refreshToken', { ...COOKIE_BASE, path: '/api/auth' });
};

// ── Token helpers ─────────────────────────────────────────────
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
  return { accessToken, refreshToken };
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// ── POST /api/auth/register ───────────────────────────────────
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const { data: existing } = await supabase
      .from('users').select('id').eq('email', email).single();

    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const { data: employeeRole } = await supabase
      .from('roles').select('id').eq('name', 'employee').single();

    const password_hash = await bcrypt.hash(password, 12);

    const { data: user, error } = await supabase
      .from('users')
      .insert({ name, email, password_hash, role_id: employeeRole?.id })
      .select('id, name, email, role_id, created_at')
      .single();

    if (error) throw error;

    const { accessToken, refreshToken } = generateTokens(user.id);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await supabase.from('user_sessions').insert({
      user_id: user.id,
      token_hash: hashToken(refreshToken),
      expires_at: expiresAt,
    });

    setAuthCookies(res, accessToken, refreshToken);
    writeAuditLog({ userId: user.id, action: 'auth.register', req });

    res.status(201).json({
      message: 'Registration successful',
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/login ──────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, password_hash, is_active, role_id, roles(name)')
      .eq('email', email)
      .single();

    if (error || !user) {
      writeAuditLog({ action: 'auth.login', metadata: { email }, req, success: false });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      writeAuditLog({ userId: user.id, action: 'auth.login', req, success: false });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = generateTokens(user.id);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await supabase.from('user_sessions').insert({
      user_id: user.id,
      token_hash: hashToken(refreshToken),
      expires_at: expiresAt,
    });

    setAuthCookies(res, accessToken, refreshToken);
    writeAuditLog({ userId: user.id, action: 'auth.login', metadata: { role: user.roles?.name }, req, success: true });

    res.json({
      message: 'Login successful',
      user: { id: user.id, name: user.name, email: user.email, role: user.roles?.name },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/refresh ────────────────────────────────────
const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) return res.status(401).json({ error: 'No refresh token' });

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const tokenHash = hashToken(refreshToken);
    const { data: session, error } = await supabase
      .from('user_sessions')
      .select('id, expires_at')
      .eq('user_id', decoded.userId)
      .eq('token_hash', tokenHash)
      .single();

    if (error || !session || new Date(session.expires_at) < new Date()) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Session expired or revoked' });
    }

    await supabase.from('user_sessions').delete().eq('id', session.id);

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.userId);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await supabase.from('user_sessions').insert({
      user_id: decoded.userId,
      token_hash: hashToken(newRefreshToken),
      expires_at: expiresAt,
    });

    setAuthCookies(res, accessToken, newRefreshToken);
    res.json({ message: 'Token refreshed' });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/logout ─────────────────────────────────────
const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await supabase.from('user_sessions')
        .delete()
        .eq('user_id', req.user.id)
        .eq('token_hash', tokenHash);
    }

    writeAuditLog({ userId: req.user?.id, action: 'auth.logout', req, success: true });
    clearAuthCookies(res);
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/auth/me ──────────────────────────────────────────
const me = async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, is_active, created_at, notification_prefs, roles(name, description)')
      .eq('id', req.user.id)
      .single();

    if (error || !user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/auth/me ────────────────────────────────────────
const updateMe = async (req, res, next) => {
  try {
    const { name, password, notification_prefs } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (password) updates.password_hash = await bcrypt.hash(password, 12);
    if (notification_prefs !== undefined) updates.notification_prefs = notification_prefs;
    updates.updated_at = new Date().toISOString();

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select('id, name, email, updated_at')
      .single();

    if (error) throw error;

    writeAuditLog({ userId: req.user.id, action: 'auth.profile.update', req });
    res.json({ message: 'Profile updated', user });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/forgot-password ───────────────────────────
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Always 200 to prevent email enumeration
    const { data: user } = await supabase
      .from('users').select('id, name, email').eq('email', email).single();

    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

      await supabase.from('password_reset_tokens').delete().eq('user_id', user.id);
      await supabase.from('password_reset_tokens').insert({
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

      sendPasswordReset({ to: user.email, name: user.name, resetToken: rawToken }).catch(() => {});
      writeAuditLog({ userId: user.id, action: 'auth.forgot_password', req });
    }

    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/reset-password ────────────────────────────
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'token and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const tokenHash = hashToken(token);
    const { data: record, error } = await supabase
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used')
      .eq('token_hash', tokenHash)
      .single();

    if (error || !record) return res.status(400).json({ error: 'Invalid or expired reset token' });
    if (record.used) return res.status(400).json({ error: 'Reset token already used' });
    if (new Date(record.expires_at) < new Date()) return res.status(400).json({ error: 'Reset token has expired' });

    const password_hash = await bcrypt.hash(password, 12);

    await supabase.from('users')
      .update({ password_hash, updated_at: new Date().toISOString() })
      .eq('id', record.user_id);

    await supabase.from('password_reset_tokens').update({ used: true }).eq('id', record.id);
    await supabase.from('user_sessions').delete().eq('user_id', record.user_id);

    writeAuditLog({ userId: record.user_id, action: 'auth.reset_password', req });
    res.json({ message: 'Password reset successfully. Please log in.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, refresh, logout, me, updateMe, forgotPassword, resetPassword };
