const express = require('express');

const authController = require('../../controllers/web/authController');
const { validate } = require('../../middlewares/validate');
const { loginLimiter, registerLimiter } = require('../../middlewares/rateLimiter');
const { registerValidators, loginValidators } = require('../../validators/authValidators');

const router = express.Router();

router.get('/register', authController.showRegisterForm);
router.post(
  '/register',
  registerLimiter,
  registerValidators,
  validate('pages/auth/register'),
  authController.register
);

router.get('/login', authController.showLoginForm);
router.post(
  '/login',
  loginLimiter,
  loginValidators,
  validate('pages/auth/login'),
  authController.login
);

router.post('/logout', authController.logout);

module.exports = router;
