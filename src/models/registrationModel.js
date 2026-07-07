const pool = require('../config/db');

// No schema change was needed for this module — event_registrations
// (created in Phase 1) already has everything this phase needs: a
// status enum that includes 'approved'/'withdrawn', a UNIQUE(event_id,
// user_id) constraint (duplicate prevention), and decided_by/decided_at
// columns, which this phase repurposes to record who cancelled a
// registration (null if the volunteer cancelled it themselves, the admin's
// id if an admin removed it).

async function findByEventAndUser(eventId, userId) {
  const { rows } = await pool.query(
    'SELECT * FROM event_registrations WHERE event_id = $1 AND user_id = $2',
    [eventId, userId]
  );
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM event_registrations WHERE id = $1', [id]);
  return rows[0] || null;
}

async function create(eventId, userId) {
  const { rows } = await pool.query(
    `INSERT INTO event_registrations (event_id, user_id, status)
     VALUES ($1, $2, 'approved')
     RETURNING *`,
    [eventId, userId]
  );
  return rows[0];
}

// Used when a user re-registers for an event they previously withdrew
// from — reuses the existing row (event_id, user_id) instead of inserting
// a second one, which the UNIQUE constraint wouldn't allow anyway.
async function reactivate(id) {
  const { rows } = await pool.query(
    `UPDATE event_registrations
     SET status = 'approved', applied_at = now(), decided_by = NULL, decided_at = NULL
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return rows[0];
}

async function withdraw(id, decidedBy) {
  const { rows } = await pool.query(
    `UPDATE event_registrations
     SET status = 'withdrawn', decided_by = $2, decided_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, decidedBy || null]
  );
  return rows[0];
}

// "My Registered Events" — every registration (active or cancelled) for
// this user, newest event first, with enough event data to render the list
// without a second round of queries per row.
// attendance_status/attendance columns are added here (Phase 6 integration)
// so the My Registered Events page can show an attendance badge per row
// without a second query per registration. attendance_status is null when
// no attendance record exists yet (pending).
async function listForUser(userId) {
  const { rows } = await pool.query(
    `SELECT
       event_registrations.*,
       events.title,
       events.start_datetime,
       events.end_datetime,
       events.location,
       events.registration_deadline,
       events.status AS event_status,
       event_categories.name AS category_name,
       attendance.status AS attendance_status
     FROM event_registrations
     JOIN events ON events.id = event_registrations.event_id
     JOIN event_categories ON event_categories.id = events.category_id
     LEFT JOIN attendance ON attendance.event_registration_id = event_registrations.id
     WHERE event_registrations.user_id = $1
     ORDER BY events.start_datetime DESC`,
    [userId]
  );
  return rows;
}

// Admin's per-event volunteer list, optionally searched by name/email.
async function listForEvent(eventId, { search } = {}) {
  const conditions = ['event_registrations.event_id = $1'];
  const params = [eventId];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(users.name ILIKE $${params.length} OR users.email ILIKE $${params.length})`);
  }

  const { rows } = await pool.query(
    `SELECT
       event_registrations.*,
       users.name AS volunteer_name,
       users.email AS volunteer_email
     FROM event_registrations
     JOIN users ON users.id = event_registrations.user_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY event_registrations.applied_at DESC`,
    params
  );
  return rows;
}

async function getEventStats(eventId) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'approved')::int AS total_registered,
       COUNT(*) FILTER (WHERE status = 'withdrawn')::int AS total_cancelled
     FROM event_registrations
     WHERE event_id = $1`,
    [eventId]
  );
  return rows[0];
}

async function countApprovedForUser(userId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM event_registrations WHERE user_id = $1 AND status = 'approved'`,
    [userId]
  );
  return rows[0].count;
}

async function countDistinctActiveVolunteers() {
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT user_id)::int AS count FROM event_registrations WHERE status = 'approved'`
  );
  return rows[0].count;
}

module.exports = {
  findByEventAndUser,
  findById,
  create,
  reactivate,
  withdraw,
  listForUser,
  listForEvent,
  getEventStats,
  countApprovedForUser,
  countDistinctActiveVolunteers,
};
