const pool = require('../config/db');

// Cross-cutting aggregate queries for the Reports & Analytics module — these
// don't belong to any single entity's own model since each one joins across
// several tables purely for reporting, never for that entity's own CRUD.
//
// Style note: unlike the simple `list()` filters in donationModel/
// certificateModel (single table, conditions built into a dynamic WHERE),
// several queries below use LEFT JOINs with the optional filter living in
// the JOIN's own ON clause (`$n::type IS NULL OR column = $n`) instead of a
// dynamically-built WHERE. That's deliberate: a WHERE-clause filter on a
// LEFT-joined column would silently drop rows that have zero matching child
// rows (e.g. a volunteer with no registrations in a date range would vanish
// entirely, instead of showing zeroes) — the ON-clause form keeps the base
// row and only scopes which child rows count toward its aggregates.

// ---- Event Report ----
async function getEventReport({ eventId, dateFrom, dateTo } = {}) {
  const { rows } = await pool.query(
    `SELECT
       events.id,
       events.title,
       events.status,
       events.start_datetime,
       events.end_datetime,
       events.capacity,
       event_categories.name AS category_name,
       COUNT(DISTINCT er.id)::int AS total_registrations,
       COUNT(DISTINCT att.id) FILTER (WHERE att.status = 'attended')::int AS total_attendance,
       (events.capacity - COUNT(DISTINCT er.id))::int AS remaining_capacity
     FROM events
     JOIN event_categories ON event_categories.id = events.category_id
     LEFT JOIN event_registrations er ON er.event_id = events.id AND er.status = 'approved'
     LEFT JOIN attendance att ON att.event_registration_id = er.id
     WHERE ($1::int IS NULL OR events.id = $1)
       AND ($2::date IS NULL OR events.start_datetime::date >= $2)
       AND ($3::date IS NULL OR events.start_datetime::date <= $3)
     GROUP BY events.id, event_categories.name
     ORDER BY events.start_datetime DESC`,
    [eventId || null, dateFrom || null, dateTo || null]
  );
  return rows;
}

// ---- Volunteer Report ----
// Registrations/attendance and certificates are pre-aggregated in their own
// subqueries (each grouped down to one row per user_id) before joining to
// users. Joining both raw tables directly to users in a single query would
// fan out — a volunteer with 2 registrations and 2 certificates would
// produce 2x2 = 4 combined rows, silently multiplying the summed hours.
async function getVolunteerReport({ userId, dateFrom, dateTo } = {}) {
  const { rows } = await pool.query(
    `SELECT
       users.id,
       users.name,
       users.email,
       COALESCE(reg.registered_events, 0)::int AS registered_events,
       COALESCE(reg.events_attended, 0)::int AS events_attended,
       COALESCE(reg.total_hours, 0) AS total_hours,
       COALESCE(cert.certificates_earned, 0)::int AS certificates_earned
     FROM users
     LEFT JOIN (
       SELECT
         er.user_id,
         COUNT(DISTINCT er.id) AS registered_events,
         COUNT(DISTINCT att.id) FILTER (WHERE att.status = 'attended') AS events_attended,
         COALESCE(SUM(att.hours_contributed) FILTER (WHERE att.status = 'attended'), 0) AS total_hours
       FROM event_registrations er
       LEFT JOIN attendance att ON att.event_registration_id = er.id
       WHERE er.status = 'approved'
         AND ($2::date IS NULL OR er.applied_at::date >= $2)
         AND ($3::date IS NULL OR er.applied_at::date <= $3)
       GROUP BY er.user_id
     ) reg ON reg.user_id = users.id
     LEFT JOIN (
       SELECT user_id, COUNT(*) AS certificates_earned
       FROM certificates
       WHERE ($2::date IS NULL OR issued_at::date >= $2)
         AND ($3::date IS NULL OR issued_at::date <= $3)
       GROUP BY user_id
     ) cert ON cert.user_id = users.id
     WHERE users.role = 'user'
       AND ($1::int IS NULL OR users.id = $1)
     ORDER BY users.name ASC`,
    [userId || null, dateFrom || null, dateTo || null]
  );
  return rows.map((row) => ({ ...row, total_hours: Number(row.total_hours) }));
}

// ---- Donation Report ----
async function getDonationReportRows({ dateFrom, dateTo, donationType, status } = {}) {
  const { rows } = await pool.query(
    `SELECT donations.*, users.name AS donor_name, users.email AS donor_email
     FROM donations
     JOIN users ON users.id = donations.donor_id
     WHERE ($1::date IS NULL OR donations.donated_at::date >= $1)
       AND ($2::date IS NULL OR donations.donated_at::date <= $2)
       AND ($3::text IS NULL OR donations.donation_type = $3)
       AND ($4::text IS NULL OR donations.status = $4)
     ORDER BY donations.donated_at DESC`,
    [dateFrom || null, dateTo || null, donationType || null, status || null]
  );
  return rows;
}

async function getDonationReportByType({ dateFrom, dateTo, donationType, status } = {}) {
  const { rows } = await pool.query(
    `SELECT
       donation_type,
       COUNT(*)::int AS count,
       COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) AS total_amount
     FROM donations
     WHERE ($1::date IS NULL OR donated_at::date >= $1)
       AND ($2::date IS NULL OR donated_at::date <= $2)
       AND ($3::text IS NULL OR donation_type = $3)
       AND ($4::text IS NULL OR status = $4)
     GROUP BY donation_type
     ORDER BY donation_type`,
    [dateFrom || null, dateTo || null, donationType || null, status || null]
  );
  return rows.map((row) => ({ ...row, total_amount: Number(row.total_amount) }));
}

async function getDonationReportByStatus({ dateFrom, dateTo, donationType, status } = {}) {
  const { rows } = await pool.query(
    `SELECT
       status,
       COUNT(*)::int AS count,
       COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) AS total_amount
     FROM donations
     WHERE ($1::date IS NULL OR donated_at::date >= $1)
       AND ($2::date IS NULL OR donated_at::date <= $2)
       AND ($3::text IS NULL OR donation_type = $3)
       AND ($4::text IS NULL OR status = $4)
     GROUP BY status
     ORDER BY status`,
    [dateFrom || null, dateTo || null, donationType || null, status || null]
  );
  return rows.map((row) => ({ ...row, total_amount: Number(row.total_amount) }));
}

async function getDonationReportTotals({ dateFrom, dateTo, donationType, status } = {}) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)::int AS count,
       COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) AS total_amount
     FROM donations
     WHERE ($1::date IS NULL OR donated_at::date >= $1)
       AND ($2::date IS NULL OR donated_at::date <= $2)
       AND ($3::text IS NULL OR donation_type = $3)
       AND ($4::text IS NULL OR status = $4)`,
    [dateFrom || null, dateTo || null, donationType || null, status || null]
  );
  return { count: rows[0].count, totalAmount: Number(rows[0].total_amount) };
}

// ---- Certificate Report ----
async function getCertificateReportRows({ dateFrom, dateTo, eventId, userId, status } = {}) {
  const { rows } = await pool.query(
    `SELECT
       certificates.*,
       users.name AS volunteer_name,
       users.email AS volunteer_email,
       events.title AS event_title
     FROM certificates
     JOIN users ON users.id = certificates.user_id
     JOIN events ON events.id = certificates.event_id
     WHERE ($1::date IS NULL OR certificates.issued_at::date >= $1)
       AND ($2::date IS NULL OR certificates.issued_at::date <= $2)
       AND ($3::int IS NULL OR certificates.event_id = $3)
       AND ($4::int IS NULL OR certificates.user_id = $4)
       AND ($5::text IS NULL OR certificates.status = $5)
     ORDER BY certificates.issued_at DESC`,
    [dateFrom || null, dateTo || null, eventId || null, userId || null, status || null]
  );
  return rows;
}

async function getCertificateReportStats({ dateFrom, dateTo, eventId, userId, status } = {}) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)::int AS generated,
       COUNT(*) FILTER (WHERE status = 'revoked')::int AS revoked
     FROM certificates
     WHERE ($1::date IS NULL OR issued_at::date >= $1)
       AND ($2::date IS NULL OR issued_at::date <= $2)
       AND ($3::int IS NULL OR event_id = $3)
       AND ($4::int IS NULL OR user_id = $4)
       AND ($5::text IS NULL OR status = $5)`,
    [dateFrom || null, dateTo || null, eventId || null, userId || null, status || null]
  );
  return { generated: rows[0].generated, revoked: rows[0].revoked };
}

// ---- Charts (all platform-wide, unfiltered) ----

// Shared shape for the three "last 6 months, zero-filled" time-series
// charts below: generate_series supplies every month bucket (including ones
// with no activity) so the chart never silently skips a quiet month.
async function getRegistrationsOverTime() {
  const { rows } = await pool.query(
    `SELECT to_char(m.month, 'Mon YYYY') AS label, COALESCE(counts.count, 0)::int AS count
     FROM generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') AS m(month)
     LEFT JOIN (
       SELECT date_trunc('month', applied_at) AS month, COUNT(*) AS count
       FROM event_registrations
       GROUP BY 1
     ) counts ON counts.month = m.month
     ORDER BY m.month`
  );
  return rows;
}

async function getVolunteerHoursByMonth() {
  const { rows } = await pool.query(
    `SELECT to_char(m.month, 'Mon YYYY') AS label, COALESCE(totals.hours, 0) AS hours
     FROM generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') AS m(month)
     LEFT JOIN (
       SELECT date_trunc('month', events.start_datetime) AS month, SUM(attendance.hours_contributed) AS hours
       FROM attendance
       JOIN event_registrations ON event_registrations.id = attendance.event_registration_id
       JOIN events ON events.id = event_registrations.event_id
       WHERE attendance.status = 'attended'
       GROUP BY 1
     ) totals ON totals.month = m.month
     ORDER BY m.month`
  );
  return rows.map((row) => ({ ...row, hours: Number(row.hours) }));
}

async function getCertificatesOverTime() {
  const { rows } = await pool.query(
    `SELECT to_char(m.month, 'Mon YYYY') AS label, COALESCE(counts.count, 0)::int AS count
     FROM generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') AS m(month)
     LEFT JOIN (
       SELECT date_trunc('month', issued_at) AS month, COUNT(*) AS count
       FROM certificates
       GROUP BY 1
     ) counts ON counts.month = m.month
     ORDER BY m.month`
  );
  return rows;
}

// Most recent 8 events with registration/attendance activity, oldest first
// (left-to-right chronological reading), for the "Attendance by Event" chart.
async function getAttendanceByEvent() {
  const { rows } = await pool.query(
    `SELECT * FROM (
       SELECT
         events.id,
         events.title,
         COUNT(DISTINCT er.id)::int AS total_registrations,
         COUNT(DISTINCT att.id) FILTER (WHERE att.status = 'attended')::int AS total_attendance
       FROM events
       LEFT JOIN event_registrations er ON er.event_id = events.id AND er.status = 'approved'
       LEFT JOIN attendance att ON att.event_registration_id = er.id
       GROUP BY events.id
       HAVING COUNT(DISTINCT er.id) > 0
       ORDER BY events.start_datetime DESC
       LIMIT 8
     ) recent
     ORDER BY recent.id ASC`
  );
  return rows;
}

module.exports = {
  getEventReport,
  getVolunteerReport,
  getDonationReportRows,
  getDonationReportByType,
  getDonationReportByStatus,
  getDonationReportTotals,
  getCertificateReportRows,
  getCertificateReportStats,
  getRegistrationsOverTime,
  getVolunteerHoursByMonth,
  getCertificatesOverTime,
  getAttendanceByEvent,
};
