const express = require('express');

const adminEventController = require('../../controllers/web/adminEventController');
const adminRegistrationController = require('../../controllers/web/adminRegistrationController');
const adminAttendanceController = require('../../controllers/web/adminAttendanceController');
const adminCertificateController = require('../../controllers/web/adminCertificateController');
const { verifyJwt } = require('../../middlewares/verifyJwt');
const { requireRole } = require('../../middlewares/requireRole');
const { uploadEventBanner } = require('../../middlewares/upload');
const { verifyCsrfAfterUpload } = require('../../middlewares/csrf');
const { eventValidators } = require('../../validators/eventValidators');

// Mounted at /admin/events in app.js (not '/') specifically so this
// blanket verifyJwt + requireRole('admin') check only ever runs for
// requests actually under /admin/events — mounting a `router.use(...)`
// with no path at the app root would run it for every request that
// reaches this router in the middleware chain, even ones that don't match
// any route defined below (this bit us once already — see
// docs/PHASE5_VOLUNTEER_REGISTRATION.md).
const router = express.Router();

router.use(verifyJwt, requireRole('admin'));

router.get('/', adminEventController.list);
router.get('/create', adminEventController.showCreateForm);
router.post(
  '/',
  uploadEventBanner,
  verifyCsrfAfterUpload,
  eventValidators,
  adminEventController.create
);
router.get('/:id', adminEventController.view);
router.get('/:id/edit', adminEventController.showEditForm);
router.post(
  '/:id/update',
  uploadEventBanner,
  verifyCsrfAfterUpload,
  eventValidators,
  adminEventController.update
);
router.post('/:id/delete', adminEventController.remove);
router.post('/:id/status', adminEventController.updateStatus);

router.get('/:id/volunteers', adminRegistrationController.list);
router.post('/:id/volunteers/:registrationId/remove', adminRegistrationController.remove);

router.get('/:id/attendance', adminAttendanceController.list);
router.post('/:id/attendance/:registrationId/check-in', adminAttendanceController.checkIn);
router.post('/:id/attendance/:registrationId/check-out', adminAttendanceController.checkOut);
router.post('/:id/attendance/:registrationId/mark-present', adminAttendanceController.markPresent);
router.post('/:id/attendance/:registrationId/mark-absent', adminAttendanceController.markAbsent);
router.get('/:id/attendance/:registrationId/edit', adminAttendanceController.showEditForm);
router.post('/:id/attendance/:registrationId/edit', adminAttendanceController.update);

router.get('/:id/certificates', adminCertificateController.eventRoster);
router.post('/:id/certificates/:registrationId/generate', adminCertificateController.generate);

module.exports = router;
