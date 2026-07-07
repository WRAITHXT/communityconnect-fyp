const express = require('express');

const eventController = require('../../controllers/web/eventController');
const { verifyJwt } = require('../../middlewares/verifyJwt');

const router = express.Router();

router.use(verifyJwt);

router.get('/events', eventController.browseEvents);
router.get('/events/:id', eventController.viewEvent);

module.exports = router;
