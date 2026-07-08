const { doubleCsrf } = require('csrf-csrf');

const config = require('../config/env');
const logger = require('../utils/logger');
const { cookieName: jwtCookieName } = require('../config/jwt');

// Double-submit-cookie CSRF protection (stateless — this app has no
// server-side session store to bind a synchronizer token to). The CSRF
// cookie's HMAC is scoped to the caller's JWT when one exists, so a stolen
// CSRF cookie is useless without the matching (httpOnly, separately-scoped)
// auth cookie, and re-logging in as a different user invalidates any
// previously-issued CSRF token. Anonymous requests (the login/register
// forms themselves, before a JWT exists) share a fixed identifier — there is
// no per-user state to protect on those routes yet.
const { doubleCsrfProtection, generateCsrfToken, validateRequest, invalidCsrfTokenError } =
  doubleCsrf({
    getSecret: () => config.csrfSecret,
    getSessionIdentifier: (req) => req.cookies?.[jwtCookieName] || 'anonymous',
    cookieName: config.nodeEnv === 'production' ? '__Host-cc.csrf-token' : 'cc.csrf-token',
    cookieOptions: {
      sameSite: 'strict',
      secure: config.nodeEnv === 'production',
      httpOnly: true,
      path: '/',
    },
    getCsrfTokenFromRequest: (req) => req.body && req.body._csrf,
    // multipart/form-data requests (the event banner-upload form) can never
    // be validated here: express.json/express.urlencoded never populate
    // req.body for that content type, only multer does, and multer runs as
    // route-specific middleware *after* this global one — so req.body._csrf
    // is always empty at this point regardless of what the form actually
    // submitted. Those requests are re-validated by verifyCsrfAfterUpload,
    // applied after multer, at the two routes that need it (see
    // routes/web/adminEventRoutes.js).
    skipCsrfProtection: (req) => Boolean(req.is('multipart/form-data')),
  });

// Makes the token available to every EJS render() call as `csrfToken`,
// the same "available everywhere without every controller passing it"
// pattern as attachCurrentUser/currentUser — every page with a POST form
// needs it, and generating it is cheap.
function attachCsrfToken(req, res, next) {
  res.locals.csrfToken = generateCsrfToken(req, res);
  next();
}

// For the multipart/form-data routes the global doubleCsrfProtection above
// deliberately skips (see skipCsrfProtection). Must be applied after the
// route's own multer middleware, once req.body._csrf actually exists.
function verifyCsrfAfterUpload(req, res, next) {
  if (!validateRequest(req)) return next(invalidCsrfTokenError);
  next();
}

// Renders a graceful 403 instead of the library's raw error — same pattern
// as requireRole's 403 page. Must be registered after doubleCsrfProtection
// and before the generic errorHandler.
// eslint-disable-next-line no-unused-vars
function handleCsrfError(err, req, res, next) {
  if (err.code !== 'EBADCSRFTOKEN') return next(err);

  logger.warn(`CSRF validation failed - ${req.method} ${req.originalUrl}`);
  return res.status(403).render('pages/error', {
    title: 'Forbidden - CommunityConnect',
    status: 403,
    message:
      'This form could not be submitted (your session may have expired). Please refresh the page and try again.',
  });
}

module.exports = { doubleCsrfProtection, attachCsrfToken, verifyCsrfAfterUpload, handleCsrfError };
