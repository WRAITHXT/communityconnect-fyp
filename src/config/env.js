require('dotenv').config();

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,

  // Reserved for the Database Design phase.
  databaseUrl: process.env.DATABASE_URL,

  // Reserved for the Authentication phase (Phase 1).
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '2h',

  logLevel: process.env.LOG_LEVEL || 'info',
};

module.exports = config;
