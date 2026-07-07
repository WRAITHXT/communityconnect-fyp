const express = require('express');

const adminReportController = require('../../controllers/web/adminReportController');
const { verifyJwt } = require('../../middlewares/verifyJwt');
const { requireRole } = require('../../middlewares/requireRole');

// Mounted at /admin/reports in app.js (not '/') — same reasoning as every
// other admin router since Phase 5: a blanket router.use(verifyJwt,
// requireRole('admin')) must only ever run for requests genuinely under
// this router's own path.
const router = express.Router();

router.use(verifyJwt, requireRole('admin'));

router.get('/', adminReportController.overview);

router.get('/events', adminReportController.eventReport);
router.get('/events/export.csv', adminReportController.exportEventCsv);
router.get('/events/export.pdf', adminReportController.exportEventPdf);

router.get('/volunteers', adminReportController.volunteerReport);
router.get('/volunteers/export.csv', adminReportController.exportVolunteerCsv);
router.get('/volunteers/export.pdf', adminReportController.exportVolunteerPdf);

router.get('/donations', adminReportController.donationReport);
router.get('/donations/export.csv', adminReportController.exportDonationCsv);
router.get('/donations/export.pdf', adminReportController.exportDonationPdf);

router.get('/certificates', adminReportController.certificateReport);
router.get('/certificates/export.csv', adminReportController.exportCertificateCsv);
router.get('/certificates/export.pdf', adminReportController.exportCertificatePdf);

module.exports = router;
