const pool = require('../config/db');

const SELECT_BASE = `
  SELECT donations.*, users.name AS donor_name, users.email AS donor_email
  FROM donations
  JOIN users ON users.id = donations.donor_id
`;

async function create(data) {
  const { rows } = await pool.query(
    `INSERT INTO donations (donor_id, donation_type, amount, description, donated_at, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [data.donorId, data.donationType, data.amount, data.description, data.donatedAt, data.status]
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await pool.query(`${SELECT_BASE} WHERE donations.id = $1`, [id]);
  return rows[0] || null;
}

async function update(id, data) {
  const { rows } = await pool.query(
    `UPDATE donations SET
       donation_type = $1,
       amount = $2,
       description = $3,
       donated_at = $4,
       status = $5
     WHERE id = $6
     RETURNING *`,
    [data.donationType, data.amount, data.description, data.donatedAt, data.status, id]
  );
  return rows[0] || null;
}

async function remove(id) {
  const { rows } = await pool.query('DELETE FROM donations WHERE id = $1 RETURNING id', [id]);
  return rows.length > 0;
}

// Donor-facing: "My Donations" history, filterable by date and type.
async function listForUser(userId, { date, donationType } = {}) {
  const conditions = ['donations.donor_id = $1'];
  const params = [userId];

  if (date) {
    params.push(date);
    conditions.push(`donations.donated_at::date = $${params.length}`);
  }
  if (donationType) {
    params.push(donationType);
    conditions.push(`donations.donation_type = $${params.length}`);
  }

  const { rows } = await pool.query(
    `${SELECT_BASE} WHERE ${conditions.join(' AND ')} ORDER BY donations.donated_at DESC`,
    params
  );
  return rows;
}

// Admin-facing: every donation, searchable by donor name/email and
// filterable by type/date/status.
async function list({ search, donationType, date, status } = {}) {
  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(users.name ILIKE $${params.length} OR users.email ILIKE $${params.length})`);
  }
  if (donationType) {
    params.push(donationType);
    conditions.push(`donations.donation_type = $${params.length}`);
  }
  if (date) {
    params.push(date);
    conditions.push(`donations.donated_at::date = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`donations.status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `${SELECT_BASE} ${where} ORDER BY donations.donated_at DESC`,
    params
  );
  return rows;
}

// Only completed monetary donations count toward a total — pending is
// unconfirmed, cancelled didn't happen, and non-monetary types have no
// amount to sum.
async function getTotalForUser(userId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM donations
     WHERE donor_id = $1 AND status = 'completed' AND amount IS NOT NULL`,
    [userId]
  );
  return Number(rows[0].total);
}

async function countAll() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM donations');
  return rows[0].count;
}

async function getAdminStats() {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)::int AS total_donations,
       COUNT(*) FILTER (WHERE status = 'completed')::int AS total_completed,
       COUNT(*) FILTER (WHERE status = 'pending')::int AS total_pending,
       COUNT(*) FILTER (WHERE status = 'cancelled')::int AS total_cancelled,
       COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) AS total_amount_received
     FROM donations`
  );
  const stats = rows[0];
  return {
    totalDonations: stats.total_donations,
    totalCompleted: stats.total_completed,
    totalPending: stats.total_pending,
    totalCancelled: stats.total_cancelled,
    totalAmountReceived: Number(stats.total_amount_received),
  };
}

async function getSummaryByType() {
  const { rows } = await pool.query(
    `SELECT
       donation_type,
       COUNT(*)::int AS count,
       COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) AS total_amount
     FROM donations
     GROUP BY donation_type
     ORDER BY donation_type`
  );
  return rows.map((row) => ({ ...row, total_amount: Number(row.total_amount) }));
}

module.exports = {
  create,
  findById,
  update,
  remove,
  listForUser,
  list,
  getTotalForUser,
  countAll,
  getAdminStats,
  getSummaryByType,
};
