const pool = require('../config/db');

async function findByRegistrationId(eventRegistrationId) {
  const { rows } = await pool.query('SELECT * FROM attendance WHERE event_registration_id = $1', [
    eventRegistrationId,
  ]);
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM attendance WHERE id = $1', [id]);
  return rows[0] || null;
}

async function checkIn(eventRegistrationId, adminId) {
  const { rows } = await pool.query(
    `INSERT INTO attendance (event_registration_id, status, check_in_time, hours_contributed, marked_by)
     VALUES ($1, 'attended', now(), 0, $2)
     RETURNING *`,
    [eventRegistrationId, adminId]
  );
  return rows[0];
}

async function checkOut(id, checkOutTime, hours, adminId) {
  const { rows } = await pool.query(
    `UPDATE attendance
     SET check_out_time = $2, hours_contributed = $3, marked_by = $4, marked_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, checkOutTime, hours, adminId]
  );
  return rows[0];
}

// Direct-mark path (no live check-in/check-out) — hours come from the
// event's scheduled start/end time, computed by the service layer.
async function markPresent(eventRegistrationId, hours, adminId) {
  const { rows } = await pool.query(
    `INSERT INTO attendance (event_registration_id, status, hours_contributed, marked_by)
     VALUES ($1, 'attended', $2, $3)
     RETURNING *`,
    [eventRegistrationId, hours, adminId]
  );
  return rows[0];
}

async function markAbsent(eventRegistrationId, adminId) {
  const { rows } = await pool.query(
    `INSERT INTO attendance (event_registration_id, status, hours_contributed, marked_by)
     VALUES ($1, 'no_show', 0, $2)
     RETURNING *`,
    [eventRegistrationId, adminId]
  );
  return rows[0];
}

// Admin correction pathway — can rewrite status, timestamps, and hours.
async function update(id, { status, checkInTime, checkOutTime, hoursContributed, adminId }) {
  const { rows } = await pool.query(
    `UPDATE attendance
     SET status = $2, check_in_time = $3, check_out_time = $4, hours_contributed = $5,
         marked_by = $6, marked_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, status, checkInTime, checkOutTime, hoursContributed, adminId]
  );
  return rows[0] || null;
}

// Admin's per-event attendance roster: every APPROVED registration for the
// event, left-joined with its attendance record (null fields = pending,
// no attendance recorded yet).
async function listForEvent(eventId) {
  const { rows } = await pool.query(
    `SELECT
       event_registrations.id AS registration_id,
       event_registrations.user_id,
       users.name AS volunteer_name,
       users.email AS volunteer_email,
       attendance.id AS attendance_id,
       attendance.status AS attendance_status,
       attendance.check_in_time,
       attendance.check_out_time,
       attendance.hours_contributed
     FROM event_registrations
     JOIN users ON users.id = event_registrations.user_id
     LEFT JOIN attendance ON attendance.event_registration_id = event_registrations.id
     WHERE event_registrations.event_id = $1 AND event_registrations.status = 'approved'
     ORDER BY users.name ASC`,
    [eventId]
  );
  return rows;
}

async function getEventStats(eventId) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(event_registrations.id)::int AS total_registered,
       COUNT(*) FILTER (WHERE attendance.status = 'attended')::int AS total_present,
       COUNT(*) FILTER (WHERE attendance.status = 'no_show')::int AS total_absent,
       COALESCE(SUM(attendance.hours_contributed) FILTER (WHERE attendance.status = 'attended'), 0) AS total_hours
     FROM event_registrations
     LEFT JOIN attendance ON attendance.event_registration_id = event_registrations.id
     WHERE event_registrations.event_id = $1 AND event_registrations.status = 'approved'`,
    [eventId]
  );
  const stats = rows[0];
  return {
    totalRegistered: stats.total_registered,
    totalPresent: stats.total_present,
    totalAbsent: stats.total_absent,
    totalPending: stats.total_registered - stats.total_present - stats.total_absent,
    totalHours: Number(stats.total_hours),
  };
}

// Volunteer-facing: total hours across every event, for the dashboard card
// and the "My Volunteer Hours" page.
async function getTotalHoursForUser(userId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(attendance.hours_contributed), 0) AS total_hours
     FROM attendance
     JOIN event_registrations ON event_registrations.id = attendance.event_registration_id
     WHERE event_registrations.user_id = $1 AND attendance.status = 'attended'`,
    [userId]
  );
  return Number(rows[0].total_hours);
}

// Volunteer-facing attendance history — only registrations with a recorded
// outcome (present or absent); a still-pending registration isn't
// "history" yet and belongs on the My Registered Events page instead.
async function listHistoryForUser(userId) {
  const { rows } = await pool.query(
    `SELECT
       attendance.*,
       events.title,
       events.start_datetime,
       events.end_datetime,
       event_categories.name AS category_name
     FROM attendance
     JOIN event_registrations ON event_registrations.id = attendance.event_registration_id
     JOIN events ON events.id = event_registrations.event_id
     JOIN event_categories ON event_categories.id = events.category_id
     WHERE event_registrations.user_id = $1
     ORDER BY events.start_datetime DESC`,
    [userId]
  );
  return rows;
}

module.exports = {
  findByRegistrationId,
  findById,
  checkIn,
  checkOut,
  markPresent,
  markAbsent,
  update,
  listForEvent,
  getEventStats,
  getTotalHoursForUser,
  listHistoryForUser,
};
