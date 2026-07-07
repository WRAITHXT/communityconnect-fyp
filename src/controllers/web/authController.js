const authService = require('../../services/authService');
const { cookieName, cookieOptions } = require('../../config/jwt');

function showRegisterForm(req, res) {
  res.render('pages/auth/register', {
    title: 'Register - CommunityConnect',
    errors: [],
    values: {},
  });
}

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    const user = await authService.register({ name, email, password });

    const token = authService.issueToken(user);
    res.cookie(cookieName, token, cookieOptions);
    res.redirect('/dashboard');
  } catch (err) {
    if (err instanceof authService.AuthError) {
      return res.status(409).render('pages/auth/register', {
        title: 'Register - CommunityConnect',
        errors: [err.message],
        values: { name: req.body.name, email: req.body.email },
      });
    }
    next(err);
  }
}

function showLoginForm(req, res) {
  res.render('pages/auth/login', {
    title: 'Log In - CommunityConnect',
    errors: [],
    values: {},
  });
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await authService.login({ email, password });

    const token = authService.issueToken(user);
    res.cookie(cookieName, token, cookieOptions);
    res.redirect('/dashboard');
  } catch (err) {
    if (err instanceof authService.AuthError) {
      return res.status(401).render('pages/auth/login', {
        title: 'Log In - CommunityConnect',
        errors: [err.message],
        values: { email: req.body.email },
      });
    }
    next(err);
  }
}

function logout(req, res) {
  res.clearCookie(cookieName, { path: cookieOptions.path });
  res.redirect('/login');
}

module.exports = {
  showRegisterForm,
  register,
  showLoginForm,
  login,
  logout,
};
