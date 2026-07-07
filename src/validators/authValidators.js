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
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters.')
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
  // Only a max length here (not the full complexity rules) — this is a
  // login, not a password reset; the point is capping the input size before
  // it reaches bcrypt.compare (an oversized input is wasted, attacker-
  // controlled hashing work), not re-validating an existing password's
  // shape.
  body('password')
    .notEmpty()
    .withMessage('Password is required.')
    .isLength({ max: 128 })
    .withMessage('Invalid email or password.'),
];

module.exports = { registerValidators, loginValidators };
