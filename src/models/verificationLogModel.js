const pool = require('../config/db');

async function create({ certificateId, certificateNumberAttempted, result }) {
  const { rows } = await pool.query(
    `INSERT INTO certificate_verification_logs (certificate_id, certificate_number_attempted, result)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [certificateId, certificateNumberAttempted, result]
  );
  return rows[0];
}

// Reports & Analytics — Certificate Report's "verification statistics".
// Scoped only by date range (checked_at), not by event/volunteer — a
// verification attempt is anonymous/public by design (Phase 8), so there is
// no meaningful "which volunteer" dimension to filter it by beyond the
// certificate a lookup happened to resolve to.
async function getStats({ dateFrom, dateTo } = {}) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)::int AS total_attempts,
       COUNT(*) FILTER (WHERE result = 'valid')::int AS valid_count,
       COUNT(*) FILTER (WHERE result = 'invalid')::int AS invalid_count
     FROM certificate_verification_logs
     WHERE ($1::date IS NULL OR checked_at::date >= $1)
       AND ($2::date IS NULL OR checked_at::date <= $2)`,
    [dateFrom || null, dateTo || null]
  );
  const stats = rows[0];
  return {
    totalAttempts: stats.total_attempts,
    validCount: stats.valid_count,
    invalidCount: stats.invalid_count,
  };
}

module.exports = { create, getStats };
