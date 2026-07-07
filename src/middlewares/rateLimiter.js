const rateLimit = require('express-rate-limit');

const logger = require('../utils/logger');

function onLimitReached(req) {
  logger.warn(`Rate limit exceeded - ${req.method} ${req.originalUrl} from ${req.ip}`);
}

// Login/register: brute-force and account-enumeration protection. Keyed by
// IP (default) — generous enough that a real user mistyping a password a
// few times never gets blocked, tight enough to make automated credential
// stuffing impractical.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many attempts. Please try again later.' } },
  handler: (req, res, next, options) => {
    onLimitReached(req);
    res.status(options.statusCode).render('pages/error', {
      title: 'Too Many Requests - CommunityConnect',
      status: 429,
      message: 'Too many attempts. Please wait a few minutes and try again.',
    });
  },
});

// The public certificate-verification page has no account behind it to
// lock out, but is still an unauthenticated, internet-facing endpoint that
// can be scripted — a looser limit than auth, just enough to blunt scripted
// abuse/log-spam without affecting a real visitor checking a certificate.
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    onLimitReached(req);
    res.status(options.statusCode).render('pages/verifyCertificate', {
      title: 'Verify a Certificate - CommunityConnect',
      layout: 'layouts/simple',
      errors: ['Too many attempts. Please wait a few minutes and try again.'],
      values: req.body,
      result: null,
    });
  },
});

module.exports = { authLimiter, verifyLimiter };
