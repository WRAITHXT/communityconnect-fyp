const express = require('express');

const authController = require('../../controllers/api/authController');
const { verifyJwt } = require('../../middlewares/verifyJwt');
const { requireRole } = require('../../middlewares/requireRole');

const router = express.Router();

// Temporary diagnostic route to verify RBAC during this phase — replaced by
// the real Admin Dashboard module later.
router.get('/admin/ping', verifyJwt, requireRole('admin'), authController.adminPing);

module.exports = router;
