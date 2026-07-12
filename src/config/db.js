const { Pool } = require('pg');

const config = require('./env');
const logger = require('../utils/logger');

// Connection only — no query is run and no table/schema work happens here.
// The pool is created lazily (pg does not connect until the first query),
// so the app can start even before PostgreSQL/DATABASE_URL is configured.
// Schema and migrations (node-pg-migrate) are added in the Database Design phase.
// Managed Postgres providers (Render, Heroku, etc.) terminate TLS with certs
// that usually aren't in Node's default CA trust store, so a plain
// connection either fails outright or gets rejected depending on the
// provider's pg_hba.conf. rejectUnauthorized: false is the standard pattern
// for these platforms — it still encrypts the connection, it just doesn't
// verify the cert chain (the connection is already inside the provider's
// private network in most of these setups).
const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  logger.error(`Unexpected PostgreSQL client error: ${err.message}`);
});

module.exports = pool;
