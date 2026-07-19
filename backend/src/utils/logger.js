const { createLogger, format, transports } = require('winston');
const { combine, timestamp, errors, json, colorize, printf } = format;
const path = require('path');

const isDev = process.env.NODE_ENV !== 'production';

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, correlationId, stack, ...meta }) => {
    let out = `${timestamp} [${level}]`;
    if (correlationId) out += ` [${correlationId}]`;
    out += ` ${stack || message}`;
    const extras = Object.keys(meta);
    if (extras.length) out += ` ${JSON.stringify(meta)}`;
    return out;
  })
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

const logger = createLogger({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  format: isDev ? devFormat : prodFormat,
  defaultMeta: { service: 'enterprise-nexus' },
  transports: [
    new transports.Console(),
  ],
  exceptionHandlers: [new transports.Console()],
  rejectionHandlers: [new transports.Console()],
});

// Stream for morgan
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;
