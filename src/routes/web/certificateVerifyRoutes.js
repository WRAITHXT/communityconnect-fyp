const express = require('express');

const certificateVerifyController = require('../../controllers/web/certificateVerifyController');
const { verifyCertificateValidators } = require('../../validators/certificateValidators');

// Deliberately public — no verifyJwt. Anyone with a certificate ID and
// verification code (e.g. an employer checking a volunteer's claim) must be
// able to use this page without a CommunityConnect account.
const router = express.Router();

router.get('/verify-certificate', certificateVerifyController.showForm);
router.post('/verify-certificate', verifyCertificateValidators, certificateVerifyController.verify);

module.exports = router;
