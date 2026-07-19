const logger = require('../utils/logger');
const Sentry = require('@sentry/node');

const errorHandler = (err, req, res, next) => {
  const correlationId = req.correlationId || null;

  // Report 5xx errors to Sentry (skip expected 4xx client errors)
  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    Sentry.withScope((scope) => {
      scope.setTag('correlation_id', correlationId);
      scope.setUser({ id: req.user?.id });
      Sentry.captureException(err);
    });
  }

  logger.error(`${req.method} ${req.path} — ${err.message}`, {
    correlationId,
    status: err.status || err.statusCode || 500,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  // Postgres unique-violation
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Duplicate entry — resource already exists', correlationId });
  }
  // Postgres FK violation
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced resource does not exist', correlationId });
  }
  // Multer file-size exceeded
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 10 MB.', correlationId });
  }
  // Multer file-type rejected
  if (err.message?.startsWith('Unsupported file type')) {
    return res.status(415).json({ error: err.message, correlationId });
  }
  // JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token', correlationId });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired', correlationId });
  }
  // Joi validation
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message, correlationId });
  }

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal server error' : err.message,
    correlationId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
