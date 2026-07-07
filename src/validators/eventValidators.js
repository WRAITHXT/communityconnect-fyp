const { body } = require('express-validator');

// Per-field syntactic checks only. Cross-field business rules (category
// existence, date/time ordering, registration deadline vs. start date) are
// handled by eventService.buildEventInput, which throws EventError — see
// controllers/web/adminEventController.js for how both layers combine.
const eventValidators = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required.')
    .isLength({ max: 200 })
    .withMessage('Title must be at most 200 characters.'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required.')
    .isLength({ max: 5000 })
    .withMessage('Description must be at most 5000 characters.'),
  body('categoryId')
    .notEmpty()
    .withMessage('Category is required.')
    .isInt({ min: 1 })
    .withMessage('Please select a valid category.'),
  body('location')
    .trim()
    .notEmpty()
    .withMessage('Venue is required.')
    .isLength({ max: 255 })
    .withMessage('Venue must be at most 255 characters.'),
  body('eventDate')
    .notEmpty()
    .withMessage('Event date is required.')
    .isISO8601()
    .withMessage('Invalid event date.'),
  body('startTime')
    .notEmpty()
    .withMessage('Start time is required.')
    .matches(/^\d{2}:\d{2}$/)
    .withMessage('Invalid start time.'),
  body('endTime')
    .notEmpty()
    .withMessage('End time is required.')
    .matches(/^\d{2}:\d{2}$/)
    .withMessage('Invalid end time.'),
  body('registrationDeadline')
    .notEmpty()
    .withMessage('Registration deadline is required.')
    .isISO8601()
    .withMessage('Invalid registration deadline.'),
  body('capacity')
    .notEmpty()
    .withMessage('Capacity is required.')
    .isInt({ min: 1 })
    .withMessage('Capacity must be a positive number.'),
  body('status')
    .notEmpty()
    .withMessage('Status is required.')
    .isIn(['draft', 'published', 'closed'])
    .withMessage('Please select a valid status.'),
];

module.exports = { eventValidators };
