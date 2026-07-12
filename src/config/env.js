require('dotenv').config();

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,

  databaseUrl: process.env.DATABASE_URL,

  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '2h',

  csrfSecret: process.env.CSRF_SECRET,

  logLevel: process.env.LOG_LEVEL || 'info',

  // Render sets this automatically on every instance — used to skip
  // filesystem-dependent behavior that doesn't survive Render's ephemeral,
  // per-instance disk (see utils/logger.js).
  isRender: Boolean(process.env.RENDER),
};

// Fail fast at boot rather than at the first request that needs one of
// these — a missing/weak secret should never surface for the first time as
// a confusing runtime error on someone's first login attempt (Phase 10
// hardening: "Authentication — JWT validation").
const MIN_SECRET_LENGTH = 32;

function requireSecret(name, value) {
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env and set a strong value before starting the server.`
    );
  }
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `${name} is too short (must be at least ${MIN_SECRET_LENGTH} characters). Generate a stronger value, e.g.: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    );
  }
}

requireSecret('JWT_SECRET', config.jwtSecret);
requireSecret('CSRF_SECRET', config.csrfSecret);

module.exports = config;
