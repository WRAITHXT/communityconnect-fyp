const { body } = require('express-validator');

// Both fields are free-text as printed on the certificate — no format is
// assumed beyond "not empty", since certificateService.verifyCertificate
// does the actual matching (case-insensitive on the code). Max lengths match
// the certificates table's own column sizes (certificate_number varchar(50),
// verification_code varchar(20)) — a longer value could never match a real
// certificate anyway, so it's rejected before reaching a query.
const verifyCertificateValidators = [
  body('certificateNumber')
    .trim()
    .notEmpty()
    .withMessage('Certificate ID is required.')
    .isLength({ max: 50 })
    .withMessage('Invalid certificate ID.'),
  body('verificationCode')
    .trim()
    .notEmpty()
    .withMessage('Verification code is required.')
    .isLength({ max: 20 })
    .withMessage('Invalid verification code.'),
];

module.exports = { verifyCertificateValidators };
