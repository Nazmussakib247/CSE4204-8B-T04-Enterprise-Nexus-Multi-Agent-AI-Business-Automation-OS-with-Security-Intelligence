require('dotenv').config();

// ── Sentry — must be initialised before any other require ────────────────────
const Sentry = require('@sentry/node');
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    environment: process.env.NODE_ENV ?? 'development',
  });
}

// ── Env validation — fail fast ────────────────────────────────────────────────
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET', 'N8N_SECRET'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[FATAL] Missing env vars: ${missing.join(', ')}`);
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('[FATAL] JWT_SECRET must be at least 32 characters.');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const logger = require('./utils/logger');
const correlationId = require('./middleware/correlationId.middleware');
const errorHandler = require('./middleware/error.middleware');
const supabase = require('./config/supabase');

// ── Routes ────────────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth.routes');
const hrRoutes = require('./routes/hr.routes');
const financeRoutes = require('./routes/finance.routes');
const supportRoutes = require('./routes/support.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const executiveRoutes = require('./routes/executive.routes');
const taskRoutes = require('./routes/task.routes');
const webhookRoutes = require('./routes/webhook.routes');
const securityRoutes = require('./routes/security.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const searchRoutes = require('./routes/search.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security & compression ────────────────────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// ── Correlation ID (before logging so it appears in log lines) ────────────────
app.use(correlationId);

// ── HTTP request logging via Winston ─────────────────────────────────────────
app.use(morgan('combined', { stream: logger.stream }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health check — real Supabase connectivity test ────────────────────────────
app.get('/api/health', async (req, res) => {
  const start = Date.now();
  let dbStatus = 'ok';
  let dbLatencyMs = null;

  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    dbLatencyMs = Date.now() - start;
    if (error) dbStatus = 'degraded';
  } catch {
    dbLatencyMs = Date.now() - start;
    dbStatus = 'error';
  }

  const healthy = dbStatus === 'ok';
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    correlationId: req.correlationId,
    services: {
      database: { status: dbStatus, latencyMs: dbLatencyMs },
    },
  });
});

// ── v1 API routes ─────────────────────────────────────────────────────────────
const v1 = express.Router();

v1.use('/auth', authRoutes);
v1.use('/hr', hrRoutes);
v1.use('/finance', financeRoutes);
v1.use('/support', supportRoutes);
v1.use('/analytics', analyticsRoutes);
v1.use('/executive', executiveRoutes);
v1.use('/tasks', taskRoutes);
v1.use('/webhook', webhookRoutes);
v1.use('/security', securityRoutes);
v1.use('/notifications', notificationsRoutes);
v1.use('/search', searchRoutes);
v1.use('/admin', adminRoutes);

app.use('/api/v1', v1);

// Backwards-compatible aliases (UI currently calls /api/*)
app.use('/api/auth', authRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/executive', executiveRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', correlationId: req.correlationId });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Server startup ────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  logger.info(`Enterprise NeXus backend running on port ${PORT}`, {
    env: process.env.NODE_ENV || 'development',
    port: PORT,
  });
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close((err) => {
    if (err) {
      logger.error('Error during shutdown', { err: err.message });
      process.exit(1);
    }
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force exit after 10 s if connections don't drain
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
