const express = require('express');

const adminDonationController = require('../../controllers/web/adminDonationController');
const { verifyJwt } = require('../../middlewares/verifyJwt');
const { requireRole } = require('../../middlewares/requireRole');
const {
  donationValidators,
  donationStatusValidator,
} = require('../../validators/donationValidators');

// Mounted at /admin/donations in app.js (not '/') — same reasoning as
// adminEventRoutes since Phase 5: a blanket router.use(verifyJwt,
// requireRole('admin')) must only ever run for requests genuinely under
// this router's own path, not leak onto unrelated routes mounted after it.
const router = express.Router();

router.use(verifyJwt, requireRole('admin'));

router.get('/', adminDonationController.list);
router.get('/:id/edit', adminDonationController.showEditForm);
router.post(
  '/:id/update',
  donationValidators,
  donationStatusValidator,
  adminDonationController.update
);
router.post('/:id/delete', adminDonationController.remove);

module.exports = router;
