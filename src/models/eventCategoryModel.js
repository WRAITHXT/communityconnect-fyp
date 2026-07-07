const pool = require('../config/db');

async function listAll() {
  const { rows } = await pool.query('SELECT id, name FROM event_categories ORDER BY name');
  return rows;
}

module.exports = { listAll };
