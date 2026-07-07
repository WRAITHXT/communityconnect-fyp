const { body } = require('express-validator');

// Both fields are free-text as printed on the certificate — no format is
// assumed beyond "not empty", since certificateService.verifyCertificate
// does the actual matching (case-insensitive on the code).
const verifyCertificateValidators = [
  body('certificateNumber').trim().notEmpty().withMessage('Certificate ID is required.'),
  body('verificationCode').trim().notEmpty().withMessage('Verification code is required.'),
];

module.exports = { verifyCertificateValidators };
