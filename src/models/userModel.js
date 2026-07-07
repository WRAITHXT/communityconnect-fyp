const pool = require('../config/db');

// Returns the full row, including password_hash — used internally by
// authService for credential checks. Never pass this straight to a view or
// JSON response; use sanitizeUser() first.
async function findByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

async function createUser({ name, email, passwordHash, role }) {
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role, status, token_version, email_verified_at, created_at`,
    [name, email, passwordHash, role]
  );
  return rows[0];
}

async function countUsers() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  return rows[0].count;
}

// Reports & Analytics — populates the Volunteer Report's volunteer-picker
// filter dropdown.
async function listByRole(role) {
  const { rows } = await pool.query(
    'SELECT id, name, email FROM users WHERE role = $1 ORDER BY name ASC',
    [role]
  );
  return rows;
}

function sanitizeUser(user) {
  if (!user) return null;
  const { id, name, email, role, status, created_at } = user;
  return { id, name, email, role, status, created_at };
}

module.exports = { findByEmail, findById, createUser, countUsers, listByRole, sanitizeUser };
