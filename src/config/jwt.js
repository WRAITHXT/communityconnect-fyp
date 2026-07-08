const config = require('./env');

// Cookie maxAge is expressed in milliseconds and must be kept in sync with
// JWT_EXPIRES_IN (jsonwebtoken accepts strings like '2h' for the token
// itself; the cookie needs a numeric duration). Both are fixed at 2 hours
// per the approved design in docs/PROJECT_BLUEPRINT.md, Section 9.
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

const cookieName = 'cc_token';

// res.clearCookie() only needs the attributes that identify the cookie
// (path/domain/secure/sameSite/httpOnly) — passing maxAge is deprecated in
// Express since clearCookie always clears by setting an immediate expiry.
const cookieOptions = {
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: 'strict',
  maxAge: TWO_HOURS_MS,
  path: '/',
};
const { maxAge, ...clearCookieOptions } = cookieOptions;

module.exports = {
  secret: config.jwtSecret,
  expiresIn: config.jwtExpiresIn,
  cookieName,
  cookieOptions,
  clearCookieOptions,
};
