require('dotenv').config();
require('express-async-errors');

const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const logger     = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const { sanitize } = require('./middleware/sanitize');

// Routes
const authRouter     = require('./routes/auth');
const userRouter     = require('./routes/users');
const hrRouter       = require('./routes/hr');
const {
  financeRouter, supportRouter, analyticsRouter,
  workflowRouter, executiveRouter, systemRouter,
} = require('./routes/modules');

const app = express();

// ── Security middleware ────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin:  process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max:      parseInt(process.env.RATE_LIMIT_MAX       || '100'),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests, please slow down.' },
}));

// ── Body parsing + sanitisation ────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(sanitize);

// ── Request logging ────────────────────────────────────────
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// ── Routes ────────────────────────────────────────────────
app.use('/api/auth',      authRouter);
app.use('/api/users',     userRouter);
app.use('/api/hr',        hrRouter);
app.use('/api/finance',   financeRouter);
app.use('/api/support',   supportRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/workflow',  workflowRouter);
app.use('/api/executive', executiveRouter);
app.use('/api/system',    systemRouter);

// ── 404 catch-all ─────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// ── Global error handler ───────────────────────────────────
app.use(errorHandler);

module.exports = app;
