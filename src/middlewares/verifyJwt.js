const { verifyAccessToken } = require('../utils/tokenService');
const userModel = require('../models/userModel');
const { cookieName } = require('../config/jwt');

// Decodes + validates the JWT from the httpOnly cookie and re-checks it
// against the live user row. Returns null (never throws) for any failure —
// missing cookie, bad signature, expired token, deleted/suspended user, or
// a token_version mismatch (the revocation mechanism from
// docs/PROJECT_BLUEPRINT.md, Section 9 — bumping token_version instantly
// invalidates every token issued before that point).
async function loadUserFromToken(req) {
  const token = req.cookies ? req.cookies[cookieName] : undefined;
  if (!token) return null;

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return null;
  }

  const user = await userModel.findById(payload.sub);
  if (!user) return null;
  if (user.status === 'suspended') return null;
  if (user.token_version !== payload.tokenVersion) return null;

  return user;
}

// Strict: blocks the request if there is no valid, current session.
async function verifyJwt(req, res, next) {
  const user = await loadUserFromToken(req);

  if (!user) {
    if (req.originalUrl.startsWith('/api')) {
      return res.status(401).json({ error: { message: 'Authentication required.' } });
    }
    return res.redirect('/login');
  }

  req.user = user;
  res.locals.currentUser = user;
  next();
}

// Soft: populates req.user / res.locals.currentUser when a valid session
// exists, but never blocks the request — used globally so views (e.g. the
// nav in partials/header.ejs) can render differently for signed-in users
// without every route needing to enforce authentication.
async function attachCurrentUser(req, res, next) {
  const user = await loadUserFromToken(req);
  req.user = user;
  res.locals.currentUser = user;
  next();
}

module.exports = { verifyJwt, attachCurrentUser };
