const jwt = require('jsonwebtoken');

const jwtConfig = require('../config/jwt');

function signAccessToken(payload) {
  return jwt.sign(payload, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
    algorithm: 'HS256',
  });
}

// Throws if the token is missing, malformed, expired, or has a bad signature —
// callers are expected to catch this (see middlewares/verifyJwt.js).
//
// `algorithms` is pinned explicitly (Phase 10 hardening) rather than left to
// jsonwebtoken's default inference — without it, a token forged with a
// different algorithm than the one this app actually signs with could be
// accepted under some library/key configurations ("algorithm confusion").
// This app only ever signs with HS256, so verification only ever accepts it.
function verifyAccessToken(token) {
  return jwt.verify(token, jwtConfig.secret, { algorithms: ['HS256'] });
}

module.exports = { signAccessToken, verifyAccessToken };
