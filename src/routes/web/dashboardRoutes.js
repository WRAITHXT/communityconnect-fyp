const express = require('express');

const dashboardController = require('../../controllers/web/dashboardController');
const { verifyJwt } = require('../../middlewares/verifyJwt');
const { requireRole } = require('../../middlewares/requireRole');

const router = express.Router();

router.get('/dashboard', verifyJwt, dashboardController.index);
router.get('/admin/dashboard', verifyJwt, requireRole('admin'), dashboardController.adminDashboard);

module.exports = router;
