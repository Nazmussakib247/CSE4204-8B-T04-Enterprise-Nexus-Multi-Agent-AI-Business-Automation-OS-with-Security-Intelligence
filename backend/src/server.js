const app  = require('./app');
const { ping } = require('./config/db');
const logger   = require('./utils/logger');
const aiCache  = require('./utils/aiCache');

const PORT = process.env.PORT || 5000;

const start = async () => {
  // Verify DB connection before accepting traffic
  await ping();
  logger.info('✅  Database connection verified');

  app.listen(PORT, () => {
    logger.info(`🚀  Enterprise Nexus API running on port ${PORT} [${process.env.NODE_ENV}]`);
  });

  // Evict stale AI cache every hour
  setInterval(aiCache.evict, 60 * 60 * 1000);
};

start().catch((err) => {
  logger.error('Fatal startup error', { error: err.message });
  process.exit(1);
});
