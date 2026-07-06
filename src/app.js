const path = require('path');
const express = require('express');
const morgan = require('morgan');

const config = require('./config/env');
const logger = require('./utils/logger');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

const app = express();

// ---- View engine (EJS) ----
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ---- Body parsing & static assets ----
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ---- HTTP request logging (Morgan -> Winston) ----
app.use(
  morgan(':method :url :status :res[content-length] - :response-time ms', {
    stream: { write: (message) => logger.http(message.trim()) },
  })
);

// Temporary landing route — replaced by the proper MVC routing structure
// (src/routes) once Event Management and later modules are implemented.
app.get('/', (req, res) => {
  res.render('pages/index', { env: config.nodeEnv });
});

// ---- Centralized error handling (must be registered last) ----
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
