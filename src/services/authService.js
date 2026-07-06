const bcrypt = require('bcrypt');

const userModel = require('../models/userModel');
const { signAccessToken } = require('../utils/tokenService');

const SALT_ROUNDS = 10;
const UNIQUE_VIOLATION = '23505';

class AuthError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

// Public self-registration always creates a plain 'user' account — there is
// no self-service path to 'admin' (see docs/PROJECT_BLUEPRINT.md, Section 4).
async function register({ name, email, password }) {
  const existing = await userModel.findByEmail(email);
  if (existing) {
    throw new AuthError('EMAIL_TAKEN', 'An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  try {
    return await userModel.createUser({ name, email, passwordHash, role: 'user' });
  } catch (err) {
    // Safety net for a race between the check above and the insert — the
    // users_email_unique constraint is the real guarantee, this just turns
    // a raw Postgres error into a clean, user-facing one.
    if (err.code === UNIQUE_VIOLATION) {
      throw new AuthError('EMAIL_TAKEN', 'An account with this email already exists.');
    }
    throw err;
  }
}

// Deliberately returns the same INVALID_CREDENTIALS error/message whether
// the email doesn't exist or the password is wrong, so a login attempt
// can't be used to enumerate registered email addresses.
async function login({ email, password }) {
  const user = await userModel.findByEmail(email);
  if (!user) {
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  if (user.status === 'suspended') {
    throw new AuthError('ACCOUNT_SUSPENDED', 'This account has been suspended.');
  }

  return user;
}

function issueToken(user) {
  return signAccessToken({
    sub: user.id,
    role: user.role,
    tokenVersion: user.token_version,
  });
}

module.exports = { register, login, issueToken, AuthError };
