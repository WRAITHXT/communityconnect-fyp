const express = require('express');

const attendanceController = require('../../controllers/web/attendanceController');
const { verifyJwt } = require('../../middlewares/verifyJwt');

const router = express.Router();

router.use(verifyJwt);

router.get('/my-attendance', attendanceController.myAttendance);

module.exports = router;
