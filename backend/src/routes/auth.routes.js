const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { register, registerExternal, verifyOfficeEmail, resendOfficeVerification, login, refresh, logout, me, updateMe, forgotPassword, resetPassword } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { registerSchema, registerExternalSchema, loginSchema, updateMeSchema } = require('../validators/auth.validators');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { error: 'Too many reset requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', validate(registerSchema), register);
router.post('/register-external', validate(registerExternalSchema), registerExternal);
router.post('/verify-office-email', resetLimiter, verifyOfficeEmail);
router.post('/resend-office-verification', resetLimiter, resendOfficeVerification);
router.post('/login', loginLimiter, validate(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', protect, logout);
router.get('/me', protect, me);
router.patch('/me', protect, validate(updateMeSchema), updateMe);
router.post('/forgot-password', resetLimiter, forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
