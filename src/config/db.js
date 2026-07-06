const { Pool } = require('pg');

const config = require('./env');
const logger = require('../utils/logger');

// Connection only — no query is run and no table/schema work happens here.
// The pool is created lazily (pg does not connect until the first query),
// so the app can start even before PostgreSQL/DATABASE_URL is configured.
// Schema and migrations (node-pg-migrate) are added in the Database Design phase.
const pool = new Pool({
  connectionString: config.databaseUrl,
});

pool.on('error', (err) => {
  logger.error(`Unexpected PostgreSQL client error: ${err.message}`);
});

module.exports = pool;
