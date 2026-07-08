const rateLimit = require('express-rate-limit');

const logger = require('../utils/logger');

function onLimitReached(req) {
  logger.warn(`Rate limit exceeded - ${req.method} ${req.originalUrl} from ${req.ip}`);
}

// express-rate-limit calls its `handler` as (req, res, next, options) — the
// third argument is Express's `next`, not part of the limiter's options.
function renderTooManyRequests(req, res, next, options) {
  onLimitReached(req);
  res.status(options.statusCode).render('pages/error', {
    title: 'Too Many Requests - CommunityConnect',
    status: 429,
    message: 'Too many attempts. Please wait a few minutes and try again.',
  });
}

// Login: brute-force protection, keyed by IP (default). 10 requests per 15
// minutes is generous enough that a real user mistyping a password a few
// times never gets blocked, tight enough to make automated credential
// stuffing impractical.
//
// skipSuccessfulRequests: true — the limiter is necessarily applied before
// authService.login runs (there's no way to know the outcome until the
// controller checks the password), so without this flag it counts every
// POST /login regardless of outcome. That means ordinary use — log in, log
// out, log back in later the same day — silently eats into the same budget
// as an attacker's wrong-password guesses, and a legitimate user doing
// nothing wrong could still get locked out. express-rate-limit's own
// requestWasSuccessful default (response.statusCode < 400) is exactly
// "did this request end in a redirect to /dashboard" here, so this flag
// makes the limiter count only failed attempts (401 invalid-credentials,
// 400 validation errors) — successful logins are never counted, while
// brute-force guessing still exhausts the budget exactly as before.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: { message: 'Too many attempts. Please try again later.' } },
  handler: renderTooManyRequests,
});

// Register: account-enumeration/mass-signup protection. A much longer window
// than login — legitimate registration is a rare, one-time action per
// visitor, so 5 per hour still comfortably covers a user who fumbles the
// form a few times while remaining tight against scripted account creation.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many attempts. Please try again later.' } },
  handler: renderTooManyRequests,
});

// The public certificate-verification page has no account behind it to
// lock out, but is still an unauthenticated, internet-facing endpoint that
// can be scripted — a looser limit than auth, just enough to blunt scripted
// abuse/log-spam without affecting a real visitor checking a certificate.
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
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

module.exports = { loginLimiter, registerLimiter, verifyLimiter };
