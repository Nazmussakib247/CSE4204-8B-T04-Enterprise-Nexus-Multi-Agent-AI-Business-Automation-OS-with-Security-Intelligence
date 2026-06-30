const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'enterprise_nexus',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max:      parseInt(process.env.DB_POOL_MAX || '10'),
  idleTimeoutMillis:    parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '2000'),
});

pool.on('connect', () => logger.info('PostgreSQL pool connected'));
pool.on('error', (err) => logger.error('PostgreSQL pool error', { error: err.message }));

/**
 * Execute a parameterised query.
 * @param {string} text  - SQL string with $1, $2 … placeholders
 * @param {Array}  params - Bound values
 */
const query = (text, params) => pool.query(text, params);

/**
 * Check database liveness.
 */
const ping = async () => {
  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
};

module.exports = { query, pool, ping };
