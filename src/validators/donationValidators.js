const { body } = require('express-validator');

// Per-field syntactic checks only. The cross-field rule (amount required
// when donationType is 'monetary') lives in donationService.parseCommonFields,
// mirroring the two-layer pattern used by eventValidators/eventService.
const donationValidators = [
  body('donationType')
    .notEmpty()
    .withMessage('Donation type is required.')
    .isIn(['monetary', 'food', 'clothing', 'medical_supplies', 'other'])
    .withMessage('Please select a valid donation type.'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required.')
    .isLength({ max: 2000 })
    .withMessage('Description must be at most 2000 characters.'),
  body('donatedAt')
    .notEmpty()
    .withMessage('Donation date is required.')
    .isISO8601()
    .withMessage('Invalid donation date.'),
  body('amount')
    .optional({ checkFalsy: true })
    .isFloat({ gt: 0 })
    .withMessage('Amount must be a positive number.'),
];

// Only the admin's edit form includes a status field — the donor's create
// form never does (see donationService.createDonation).
const donationStatusValidator = [
  body('status')
    .notEmpty()
    .withMessage('Status is required.')
    .isIn(['completed', 'pending', 'cancelled'])
    .withMessage('Please select a valid status.'),
];

module.exports = { donationValidators, donationStatusValidator };
