const jwt = require('jsonwebtoken');

const jwtConfig = require('../config/jwt');

function signAccessToken(payload) {
  return jwt.sign(payload, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn });
}

// Throws if the token is missing, malformed, expired, or has a bad signature —
// callers are expected to catch this (see middlewares/verifyJwt.js).
function verifyAccessToken(token) {
  return jwt.verify(token, jwtConfig.secret);
}

module.exports = { signAccessToken, verifyAccessToken };
