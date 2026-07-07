const express = require('express');

const adminEventController = require('../../controllers/web/adminEventController');
const { verifyJwt } = require('../../middlewares/verifyJwt');
const { requireRole } = require('../../middlewares/requireRole');
const { uploadEventBanner } = require('../../middlewares/upload');
const { eventValidators } = require('../../validators/eventValidators');

const router = express.Router();

router.use(verifyJwt, requireRole('admin'));

router.get('/admin/events', adminEventController.list);
router.get('/admin/events/create', adminEventController.showCreateForm);
router.post('/admin/events', uploadEventBanner, eventValidators, adminEventController.create);
router.get('/admin/events/:id', adminEventController.view);
router.get('/admin/events/:id/edit', adminEventController.showEditForm);
router.post(
  '/admin/events/:id/update',
  uploadEventBanner,
  eventValidators,
  adminEventController.update
);
router.post('/admin/events/:id/delete', adminEventController.remove);
router.post('/admin/events/:id/status', adminEventController.updateStatus);

module.exports = router;
