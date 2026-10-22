const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const supabase = require('../config/supabase');
const { sendPasswordReset, sendOfficeVerificationCode } = require('../utils/email');
const { writeAuditLog } = require('../utils/audit');

// ── Cookie helpers ────────────────────────────────────────────
const IS_PROD = process.env.NODE_ENV === 'production';

const COOKIE_BASE = {
  httpOnly: true,
  secure: IS_PROD,
  // Production browser calls now use the Vercel same-origin /api rewrite.
  // Lax prevents unnecessary third-party cookie exposure while allowing the
  // normal first-party storefront and office session flow.
  sameSite: 'lax',
  path: '/',
};

// A single long-lived session cookie, not a short access token + separate
// refresh token. Two Set-Cookie headers on one response were silently being
// collapsed to one by the Vercel rewrite proxy in front of Render, which
// dropped the refresh cookie and force-logged everyone out once the old
// 15-minute access token expired (or sporadically on reload, since only the
// first Set-Cookie header survived the proxy). One cookie sidesteps that
// proxy limitation entirely — there's nothing to drop.
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const setAuthCookies = (res, token) => {
  res.cookie('session', token, { ...COOKIE_BASE, maxAge: SESSION_MAX_AGE_MS });
};

const clearAuthCookies = (res) => {
  res.clearCookie('session', COOKIE_BASE);
};

// ── Token helpers ─────────────────────────────────────────────
const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const makeOtp = () => crypto.randomInt(100000, 1000000).toString();

const createOfficeVerificationCode = async (user) => {
  const code = makeOtp();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await supabase.from('email_verification_codes').delete().eq('user_id', user.id).eq('purpose', 'office_registration');
  const { error } = await supabase.from('email_verification_codes').insert({ user_id: user.id, purpose: 'office_registration', code_hash: hashToken(code), expires_at: expiresAt });
  if (error) throw error;
  await sendOfficeVerificationCode({ to: user.email, name: user.name, code });
};

const createCustomerVerificationCode = async (user) => {
  const code = makeOtp();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await supabase.from('email_verification_codes').delete().eq('user_id', user.id).eq('purpose', 'customer_registration');
  const { error } = await supabase.from('email_verification_codes').insert({ user_id: user.id, purpose: 'customer_registration', code_hash: hashToken(code), expires_at: expiresAt });
  if (error) throw error;
  await sendOfficeVerificationCode({ to: user.email, name: user.name, code });
};

const createAccount = async ({ name, email, password, role, req }) => {
  const { data: existing } = await supabase.from('users').select('id').eq('email', email).single();
  if (existing) {
    const err = new Error('Email already registered');
    err.statusCode = 409;
    throw err;
  }

  const { data: roleRow, error: roleErr } = await supabase
    .from('roles').select('id').eq('name', role).single();
  if (roleErr || !roleRow) {
    const err = new Error('Invalid account type');
    err.statusCode = 400;
    throw err;
  }

  const password_hash = await bcrypt.hash(password, 12);
  // Only internal office accounts require approval. Candidates must be able to
  // create an account and apply immediately from the public careers portal.
  const requiresApproval = ['admin', 'manager', 'employee'].includes(role);
  const { data: user, error } = await supabase
    .from('users')
    .insert({
      name,
      email,
      password_hash,
      role_id: roleRow.id,
      is_active: !requiresApproval,
      approval_status: requiresApproval ? 'pending' : 'approved',
    })
    .select('id, name, email, role_id, approval_status, created_at')
    .single();
  if (error) throw error;

  writeAuditLog({
    userId: user.id,
    action: requiresApproval ? 'auth.registration_requested' : 'auth.customer.register',
    metadata: { requested_role: role },
    req,
  });
  return { user, requiresApproval };
};

// Records the session (for audit/visibility) and sets the one auth cookie.
const createSessionResponse = async (res, user) => {
  const token = generateToken(user.id);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString();
  await supabase.from('user_sessions').insert({ user_id: user.id, token_hash: hashToken(token), expires_at: expiresAt });
  setAuthCookies(res, token);
};

// ── POST /api/auth/register ───────────────────────────────────
const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    const { user, requiresApproval } = await createAccount({ name, email, password, role, req });
    if (!requiresApproval) await createSessionResponse(res, user);
    else {
      try { await createOfficeVerificationCode(user); }
      catch (error) {
        writeAuditLog({ userId: user.id, action: 'auth.office_verification_email_failed', metadata: { message: error.message }, req, success: false });
        return res.status(503).json({ error: error.message, verification_required: true, email: user.email });
      }
    }
    res.status(201).json({
      message: requiresApproval ? 'Verification code sent. Verify your email to continue the approval process.' : 'Account created',
      pending_approval: requiresApproval,
      verification_required: requiresApproval,
      user: { ...user, role },
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
};

// POST /api/auth/verify-office-email — verify six-digit OTP before approval.
const verifyOfficeEmail = async (req, res, next) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !/^\d{6}$/.test(code || '')) return res.status(400).json({ error: 'Email and a six-digit code are required' });
    const purpose = req.body?.purpose === 'customer_registration' ? 'customer_registration' : 'office_registration';
    const { data: user } = await supabase.from('users').select('id, email_verified_at').eq('email', email.toLowerCase()).maybeSingle();
    if (!user) return res.status(400).json({ error: 'Invalid or expired verification code' });
    if (user.email_verified_at) return res.json({ message: 'Email already verified' });
    const { data: record } = await supabase.from('email_verification_codes').select('*').eq('user_id', user.id).eq('purpose', purpose).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!record || record.attempts >= 5 || new Date(record.expires_at) < new Date() || record.code_hash !== hashToken(code)) {
      if (record) await supabase.from('email_verification_codes').update({ attempts: record.attempts + 1 }).eq('id', record.id);
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }
    await supabase.from('users').update({ email_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', user.id);
    await supabase.from('email_verification_codes').delete().eq('id', record.id);
    writeAuditLog({ userId: user.id, action: purpose === 'customer_registration' ? 'auth.customer_email_verified' : 'auth.office_email_verified', req });
    res.json({ message: purpose === 'customer_registration' ? 'Email verified. You can now sign in.' : 'Email verified. Your office access will be approved shortly.' });
  } catch (err) { next(err); }
};

const resendOfficeVerification = async (req, res, next) => {
  try {
    const { email } = req.body || {};
    const purpose = req.body?.purpose === 'customer_registration' ? 'customer_registration' : 'office_registration';
    const { data: user } = await supabase.from('users').select('id, name, email, email_verified_at, roles(name)').eq('email', String(email || '').toLowerCase()).maybeSingle();
    if (user && !user.email_verified_at) {
      if (purpose === 'customer_registration' && user.roles?.name === 'customer') await createCustomerVerificationCode(user);
      if (purpose === 'office_registration' && ['admin', 'manager', 'employee'].includes(user.roles?.name)) await createOfficeVerificationCode(user);
    }
    res.json({ message: 'If eligible, a verification code has been sent.' });
  } catch (err) { next(err); }
};

// ── POST /api/auth/register-external ──────────────────────────
// Public signup for customer accounts. Careers applications do not create accounts.
// Kept separate from register() so the internal-staff flow is untouched and
// role is never accepted from arbitrary input there.
const registerExternal = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    const { user, requiresApproval } = await createAccount({ name, email, password, role, req });
    if (!requiresApproval) await createCustomerVerificationCode(user);
    res.status(201).json({
      message: 'Verification code sent. Verify your email to continue.',
      pending_approval: requiresApproval,
      verification_required: true,
      user: { ...user, role },
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
};

// ── POST /api/auth/login ──────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, password_hash, is_active, approval_status, email_verified_at, role_id, roles(name)')
      .eq('email', email)
      .single();

    if (error) {
      // PostgREST returns PGRST116 when .single() finds no row. That is a
      // normal bad-credentials case, not a database outage.
      if (error.code === 'PGRST116') {
        writeAuditLog({ action: 'auth.login', metadata: { email }, req, success: false });
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      console.error('[auth.login] user lookup failed:', { code: error.code, message: error.message });
      return res.status(503).json({ error: 'Sign-in service is temporarily unavailable. Please try again in a moment.' });
    }
    if (!user) {
      writeAuditLog({ action: 'auth.login', metadata: { email }, req, success: false });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isOfficeUser = ['admin', 'manager', 'employee'].includes(user.roles?.name);
    if ((isOfficeUser || user.roles?.name === 'customer') && !user.email_verified_at) {
      return res.status(403).json({ error: 'Verify the email code sent to you before signing in' });
    }
    if (user.approval_status === 'pending') {
      return res.status(403).json({ error: 'Account pending admin approval' });
    }
    if (user.approval_status === 'rejected') {
      return res.status(403).json({ error: 'Account request was not approved' });
    }
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account access has been revoked' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      writeAuditLog({ userId: user.id, action: 'auth.login', req, success: false });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await createSessionResponse(res, user);
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
// No longer a distinct refresh-token flow — there's only one cookie now.
// This just verifies the current session and, if still valid, rotates it to
// a fresh 7-day token (sliding expiration) so a still-active user is never
// forced to re-login just because the cookie is getting old.
const refresh = async (req, res, next) => {
  try {
    const token = req.cookies?.session;
    if (!token) return res.status(401).json({ error: 'No session' });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    await supabase.from('user_sessions').delete().eq('token_hash', hashToken(token));

    const newToken = generateToken(decoded.userId);
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString();
    await supabase.from('user_sessions').insert({
      user_id: decoded.userId,
      token_hash: hashToken(newToken),
      expires_at: expiresAt,
    });

    setAuthCookies(res, newToken);
    res.json({ message: 'Session refreshed' });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/logout ─────────────────────────────────────
const logout = async (req, res, next) => {
  try {
    const token = req.cookies?.session;
    if (token) {
      await supabase.from('user_sessions').delete().eq('token_hash', hashToken(token));
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

    if (error) {
      console.error('[auth.me] profile lookup failed:', { code: error.code, message: error.message });
      return res.status(500).json({ error: 'Unable to load user profile' });
    }
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      user: {
        ...user,
        role: user.roles?.name || null,
      },
    });
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
      const resetCode = makeOtp();
      const tokenHash = hashToken(resetCode);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

      await supabase.from('password_reset_tokens').delete().eq('user_id', user.id);
      await supabase.from('password_reset_tokens').insert({
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

      sendPasswordReset({ to: user.email, name: user.name, resetCode }).catch(() => {});
      writeAuditLog({ userId: user.id, action: 'auth.forgot_password', req });
    }

    res.json({ message: 'If that email is registered, a reset code has been sent.' });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/reset-password ────────────────────────────
const resetPassword = async (req, res, next) => {
  try {
    const { token, code, password, email } = req.body;
    const resetCode = code || token;
    if (!resetCode || !password) {
      return res.status(400).json({ error: 'code and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const tokenHash = hashToken(resetCode);
    let tokenQuery = supabase.from('password_reset_tokens').select('id, user_id, expires_at, used').eq('token_hash', tokenHash);
    if (email) {
      const { data: owner } = await supabase.from('users').select('id').eq('email', String(email).toLowerCase()).maybeSingle();
      if (!owner) return res.status(400).json({ error: 'Invalid or expired reset code' });
      tokenQuery = tokenQuery.eq('user_id', owner.id);
    }
    const { data: record, error } = await tokenQuery.single();

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

module.exports = { register, registerExternal, verifyOfficeEmail, resendOfficeVerification, login, refresh, logout, me, updateMe, forgotPassword, resetPassword };
