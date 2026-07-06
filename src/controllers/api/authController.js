const { sanitizeUser } = require('../../models/userModel');
const logger = require('../../utils/logger');

// Temporary diagnostic endpoint (GET /api/v1/admin/ping) proving
// verifyJwt + requireRole('admin') work together over the JSON/API path.
// Not part of the future Admin Dashboard module.
function adminPing(req, res) {
  logger.info(`Admin ping by user #${req.user.id} (${req.user.email})`);
  res.json({ message: 'Admin access confirmed.', user: sanitizeUser(req.user) });
}

module.exports = { adminPing };
