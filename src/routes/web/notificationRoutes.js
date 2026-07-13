const express = require('express');

const notificationController = require('../../controllers/web/notificationController');
const { verifyJwt } = require('../../middlewares/verifyJwt');

const router = express.Router();

router.use(verifyJwt);

router.get('/notifications', notificationController.list);
router.post('/notifications/:id/read', notificationController.markRead);
router.post('/notifications/mark-all-read', notificationController.markAllRead);

module.exports = router;
