const pool = require('../config/db');

// `related_entity_type`/`related_entity_id` exist on the table (from its
// original design) but nothing in this module writes or reads them —
// notifications here only ever need user_id/title/message/type/is_read/
// target_url. targetUrl defaults to null — a notification with no
// destination is a perfectly normal row, not an error case.
async function create({ userId, title, message, type, targetUrl = null }) {
  const { rows } = await pool.query(
    `INSERT INTO notifications (user_id, title, message, type, target_url, is_read)
     VALUES ($1, $2, $3, $4, $5, false)
     RETURNING *`,
    [userId, title, message, type, targetUrl]
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM notifications WHERE id = $1', [id]);
  return rows[0] || null;
}

async function listForUser(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return rows;
}

async function countUnreadForUser(userId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = false',
    [userId]
  );
  return rows[0].count;
}

async function markAsRead(id) {
  const { rows } = await pool.query(
    'UPDATE notifications SET is_read = true WHERE id = $1 RETURNING *',
    [id]
  );
  return rows[0] || null;
}

async function markAllAsReadForUser(userId) {
  await pool.query(
    'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
    [userId]
  );
}

module.exports = {
  create,
  findById,
  listForUser,
  countUnreadForUser,
  markAsRead,
  markAllAsReadForUser,
};
