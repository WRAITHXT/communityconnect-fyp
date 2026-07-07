const express = require('express');

const certificateController = require('../../controllers/web/certificateController');
const { verifyJwt } = require('../../middlewares/verifyJwt');

const router = express.Router();

router.use(verifyJwt);

router.get('/my-certificates', certificateController.myCertificates);
router.get('/certificates/:id', certificateController.view);
router.get('/certificates/:id/download', certificateController.download);

module.exports = router;
