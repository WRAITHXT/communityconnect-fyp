const logger = require('../utils/logger');

// 404 — converts any unmatched route into an Error so it flows into errorHandler below.
function notFoundHandler(req, res, next) {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.status = 404;
  next(error);
}

// Centralized error handler — must be registered last, after all routes.
// Responds with JSON for API routes and a rendered EJS page for web routes.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  logger.error(`${status} - ${err.message} - ${req.method} ${req.originalUrl}`);

  if (req.originalUrl.startsWith('/api')) {
    return res.status(status).json({
      error: { message: err.message || 'Internal Server Error' },
    });
  }

  return res.status(status).render('pages/error', {
    status,
    message: err.message || 'Internal Server Error',
  });
}

module.exports = { notFoundHandler, errorHandler };
