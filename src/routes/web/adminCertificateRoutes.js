const express = require('express');

const adminCertificateController = require('../../controllers/web/adminCertificateController');
const { verifyJwt } = require('../../middlewares/verifyJwt');
const { requireRole } = require('../../middlewares/requireRole');

// Mounted at /admin/certificates in app.js (not '/') — same reasoning as
// adminDonationRoutes/adminEventRoutes since Phase 5: a blanket
// router.use(verifyJwt, requireRole('admin')) must only ever run for
// requests genuinely under this router's own path.
const router = express.Router();

router.use(verifyJwt, requireRole('admin'));

router.get('/', adminCertificateController.list);
router.get('/:id', adminCertificateController.view);
router.get('/:id/download', adminCertificateController.download);
router.post('/:id/regenerate', adminCertificateController.regenerate);
router.post('/:id/revoke', adminCertificateController.revoke);

module.exports = router;
