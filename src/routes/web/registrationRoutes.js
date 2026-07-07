const express = require('express');

const registrationController = require('../../controllers/web/registrationController');
const { verifyJwt } = require('../../middlewares/verifyJwt');

const router = express.Router();

router.use(verifyJwt);

router.get('/my-registrations', registrationController.myRegistrations);
router.post('/events/:id/register', registrationController.register);
router.post('/events/:id/cancel', registrationController.cancel);

module.exports = router;
