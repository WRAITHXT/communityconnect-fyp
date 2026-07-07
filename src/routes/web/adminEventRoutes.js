const express = require('express');

const adminEventController = require('../../controllers/web/adminEventController');
const adminRegistrationController = require('../../controllers/web/adminRegistrationController');
const { verifyJwt } = require('../../middlewares/verifyJwt');
const { requireRole } = require('../../middlewares/requireRole');
const { uploadEventBanner } = require('../../middlewares/upload');
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
router.post('/', uploadEventBanner, eventValidators, adminEventController.create);
router.get('/:id', adminEventController.view);
router.get('/:id/edit', adminEventController.showEditForm);
router.post('/:id/update', uploadEventBanner, eventValidators, adminEventController.update);
router.post('/:id/delete', adminEventController.remove);
router.post('/:id/status', adminEventController.updateStatus);

router.get('/:id/volunteers', adminRegistrationController.list);
router.post('/:id/volunteers/:registrationId/remove', adminRegistrationController.remove);

module.exports = router;
