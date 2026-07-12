const path = require('path');
const winston = require('winston');

const config = require('../config/env');

const isProduction = config.nodeEnv === 'production';

const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    isProduction
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(
            ({ timestamp, level, message }) => `[${timestamp}] ${level}: ${message}`
          )
        )
  ),
  transports: [new winston.transports.Console()],
});

// File transports only in production — keeps local dev output clean and
// avoids requiring a writable logs/ directory in every environment. Skipped
// on Render specifically: its filesystem is ephemeral per-instance, so these
// files vanish on every restart/redeploy and are never visible anywhere
// (Render's own log dashboard only captures stdout/stderr, already covered
// by the Console transport above) — writing them there is pure dead weight.
if (isProduction && !config.isRender) {
  logger.add(
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
    })
  );
  logger.add(
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
    })
  );
}

module.exports = logger;
