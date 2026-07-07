const pool = require('../config/db');

const SELECT_BASE = `
  SELECT
    certificates.*,
    users.name AS volunteer_name,
    users.email AS volunteer_email,
    events.title AS event_title,
    events.start_datetime AS event_start_datetime,
    events.end_datetime AS event_end_datetime
  FROM certificates
  JOIN users ON users.id = certificates.user_id
  JOIN events ON events.id = certificates.event_id
`;

async function create(data) {
  const { rows } = await pool.query(
    `INSERT INTO certificates
       (user_id, event_id, certificate_number, verification_code, total_hours, generated_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      data.userId,
      data.eventId,
      data.certificateNumber,
      data.verificationCode,
      data.totalHours,
      data.generatedBy,
    ]
  );
  return rows[0];
}

// Regenerate: re-issues an existing certificate row in place (fresh
// verification code, issue date, and hours snapshot; reactivates it if it
// had been revoked) rather than inserting a second row — the
// UNIQUE(user_id, event_id) constraint means there can only ever be one.
async function reissue(id, { verificationCode, totalHours, generatedBy }) {
  const { rows } = await pool.query(
    `UPDATE certificates
     SET verification_code = $2,
         total_hours = $3,
         generated_by = $4,
         issued_at = now(),
         status = 'active',
         revoked_by = NULL,
         revoked_at = NULL
     WHERE id = $1
     RETURNING *`,
    [id, verificationCode, totalHours, generatedBy]
  );
  return rows[0] || null;
}

async function revoke(id, revokedBy) {
  const { rows } = await pool.query(
    `UPDATE certificates
     SET status = 'revoked', revoked_by = $2, revoked_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, revokedBy]
  );
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await pool.query(`${SELECT_BASE} WHERE certificates.id = $1`, [id]);
  return rows[0] || null;
}

async function findByEventAndUser(eventId, userId) {
  const { rows } = await pool.query(
    `${SELECT_BASE} WHERE certificates.event_id = $1 AND certificates.user_id = $2`,
    [eventId, userId]
  );
  return rows[0] || null;
}

// Public verification lookup — matches on both fields at once so a
// mismatched pair (right ID, wrong code or vice versa) never reveals which
// half was wrong.
async function findForVerification(certificateNumber, verificationCode) {
  const { rows } = await pool.query(
    `${SELECT_BASE}
     WHERE certificates.certificate_number = $1 AND certificates.verification_code = $2`,
    [certificateNumber, verificationCode]
  );
  return rows[0] || null;
}

// Volunteer-facing: every certificate earned by this user.
async function listForUser(userId) {
  const { rows } = await pool.query(
    `${SELECT_BASE} WHERE certificates.user_id = $1 ORDER BY certificates.issued_at DESC`,
    [userId]
  );
  return rows;
}

// Admin-facing: every certificate, searchable by volunteer name/email,
// event title, or certificate ID; filterable by event and issue date.
async function list({ search, eventId, date } = {}) {
  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(users.name ILIKE $${params.length} OR users.email ILIKE $${params.length}
        OR events.title ILIKE $${params.length}
        OR certificates.certificate_number ILIKE $${params.length})`
    );
  }
  if (eventId) {
    params.push(eventId);
    conditions.push(`certificates.event_id = $${params.length}`);
  }
  if (date) {
    params.push(date);
    conditions.push(`certificates.issued_at::date = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `${SELECT_BASE} ${where} ORDER BY certificates.issued_at DESC`,
    params
  );
  return rows;
}

// Admin's per-event roster for generation: every volunteer eligible for a
// certificate (approved registration + attendance marked Present), left-
// joined with any certificate already issued for them for this event, so
// the view can show "Generate" or "Already Issued" per row without a
// second query each.
async function listEligibleForEvent(eventId) {
  const { rows } = await pool.query(
    `SELECT
       event_registrations.id AS registration_id,
       event_registrations.user_id,
       users.name AS volunteer_name,
       users.email AS volunteer_email,
       attendance.hours_contributed,
       certificates.id AS certificate_id,
       certificates.certificate_number,
       certificates.status AS certificate_status
     FROM event_registrations
     JOIN users ON users.id = event_registrations.user_id
     JOIN attendance ON attendance.event_registration_id = event_registrations.id
     LEFT JOIN certificates
       ON certificates.event_id = event_registrations.event_id
      AND certificates.user_id = event_registrations.user_id
     WHERE event_registrations.event_id = $1
       AND event_registrations.status = 'approved'
       AND attendance.status = 'attended'
     ORDER BY users.name ASC`,
    [eventId]
  );
  return rows;
}

async function countAll() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM certificates');
  return rows[0].count;
}

async function countForUser(userId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS count FROM certificates WHERE user_id = $1',
    [userId]
  );
  return rows[0].count;
}

module.exports = {
  create,
  reissue,
  revoke,
  findById,
  findByEventAndUser,
  findForVerification,
  listForUser,
  listEligibleForEvent,
  list,
  countAll,
  countForUser,
};
