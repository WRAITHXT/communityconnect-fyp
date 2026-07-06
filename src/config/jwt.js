const config = require('./env');

// Cookie maxAge is expressed in milliseconds and must be kept in sync with
// JWT_EXPIRES_IN (jsonwebtoken accepts strings like '2h' for the token
// itself; the cookie needs a numeric duration). Both are fixed at 2 hours
// per the approved design in docs/PROJECT_BLUEPRINT.md, Section 9.
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

module.exports = {
  secret: config.jwtSecret,
  expiresIn: config.jwtExpiresIn,
  cookieName: 'cc_token',
  cookieOptions: {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: TWO_HOURS_MS,
    path: '/',
  },
};
