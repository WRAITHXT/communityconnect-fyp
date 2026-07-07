const express = require('express');

const authController = require('../../controllers/web/authController');
const { validate } = require('../../middlewares/validate');
const { registerValidators, loginValidators } = require('../../validators/authValidators');

const router = express.Router();

router.get('/register', authController.showRegisterForm);
router.post(
  '/register',
  registerValidators,
  validate('pages/auth/register'),
  authController.register
);

router.get('/login', authController.showLoginForm);
router.post('/login', loginValidators, validate('pages/auth/login'), authController.login);

router.post('/logout', authController.logout);

module.exports = router;
