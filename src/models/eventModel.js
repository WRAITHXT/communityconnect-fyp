const pool = require('../config/db');

// Shared SELECT for every read query below — joins in the category name and
// computes remaining_slots from event_registrations. The Volunteer
// Registration module doesn't exist yet, so approved_count is always 0
// right now and remaining_slots always equals capacity; this query needs no
// changes once that module lands, it will just start reflecting real data.
const SELECT_BASE = `
  SELECT
    events.*,
    event_categories.name AS category_name,
    events.capacity - COALESCE(reg_counts.approved_count, 0) AS remaining_slots
  FROM events
  JOIN event_categories ON event_categories.id = events.category_id
  LEFT JOIN (
    SELECT event_id, COUNT(*) AS approved_count
    FROM event_registrations
    WHERE status = 'approved'
    GROUP BY event_id
  ) reg_counts ON reg_counts.event_id = events.id
`;

// options.publicOnly restricts to published/closed (never draft) — used by
// the user-facing browse route regardless of what a client sends as a
// status filter, so draft events can never leak through query manipulation.
async function list({ search, categoryId, status, date, publicOnly } = {}) {
  const conditions = [];
  const params = [];

  if (publicOnly) {
    conditions.push(`events.status IN ('published','closed')`);
  }
  if (status) {
    params.push(status);
    conditions.push(`events.status = $${params.length}`);
  }
  if (categoryId) {
    params.push(categoryId);
    conditions.push(`events.category_id = $${params.length}`);
  }
  if (date) {
    params.push(date);
    conditions.push(`events.start_datetime::date = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`events.title ILIKE $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `${SELECT_BASE} ${where} ORDER BY events.start_datetime ASC`,
    params
  );
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query(`${SELECT_BASE} WHERE events.id = $1`, [id]);
  return rows[0] || null;
}

async function create(data) {
  const { rows } = await pool.query(
    `INSERT INTO events
       (category_id, title, description, location, start_datetime, end_datetime,
        registration_deadline, capacity, banner_image_key, status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      data.categoryId,
      data.title,
      data.description,
      data.location,
      data.startDatetime,
      data.endDatetime,
      data.registrationDeadline,
      data.capacity,
      data.bannerImageKey,
      data.status,
      data.createdBy,
    ]
  );
  return rows[0];
}

async function update(id, data) {
  const { rows } = await pool.query(
    `UPDATE events SET
       category_id = $1,
       title = $2,
       description = $3,
       location = $4,
       start_datetime = $5,
       end_datetime = $6,
       registration_deadline = $7,
       capacity = $8,
       status = $9,
       banner_image_key = $10
     WHERE id = $11
     RETURNING *`,
    [
      data.categoryId,
      data.title,
      data.description,
      data.location,
      data.startDatetime,
      data.endDatetime,
      data.registrationDeadline,
      data.capacity,
      data.status,
      data.bannerImageKey,
      id,
    ]
  );
  return rows[0] || null;
}

async function updateStatus(id, status) {
  const { rows } = await pool.query('UPDATE events SET status = $1 WHERE id = $2 RETURNING *', [
    status,
    id,
  ]);
  return rows[0] || null;
}

async function remove(id) {
  const { rows } = await pool.query('DELETE FROM events WHERE id = $1 RETURNING id', [id]);
  return rows.length > 0;
}

async function countAll() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM events');
  return rows[0].count;
}

async function countUpcomingPublished() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM events
     WHERE status = 'published' AND start_datetime > now()`
  );
  return rows[0].count;
}

// Reports & Analytics — "Published Events" stat: every published event
// regardless of date (unlike countUpcomingPublished, which is future-only).
async function countPublished() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM events WHERE status = 'published'`
  );
  return rows[0].count;
}

module.exports = {
  list,
  findById,
  create,
  update,
  updateStatus,
  remove,
  countAll,
  countUpcomingPublished,
  countPublished,
};
