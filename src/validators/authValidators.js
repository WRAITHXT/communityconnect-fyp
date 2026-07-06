const { body } = require('express-validator');

const registerValidators = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required.')
    .isLength({ max: 150 })
    .withMessage('Name must be at most 150 characters.'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('A valid email is required.')
    .isLength({ max: 255 })
    .withMessage('Email must be at most 255 characters.'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters.')
    .matches(/[a-z]/)
    .withMessage('Password must include a lowercase letter.')
    .matches(/[A-Z]/)
    .withMessage('Password must include an uppercase letter.')
    .matches(/[0-9]/)
    .withMessage('Password must include a number.'),
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match.'),
];

const loginValidators = [
  body('email').trim().isEmail().withMessage('A valid email is required.'),
  body('password').notEmpty().withMessage('Password is required.'),
];

module.exports = { registerValidators, loginValidators };
