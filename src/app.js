const path = require('path');
const express = require('express');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const expressLayouts = require('express-ejs-layouts');

const config = require('./config/env');
const logger = require('./utils/logger');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');
const { attachCurrentUser } = require('./middlewares/verifyJwt');
const webAuthRoutes = require('./routes/web/authRoutes');
const webDashboardRoutes = require('./routes/web/dashboardRoutes');

const app = express();

// ---- View engine (EJS + shared layout) ----
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/simple');
app.use(expressLayouts);

// ---- Body parsing, cookies & static assets ----
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ---- HTTP request logging (Morgan -> Winston) ----
app.use(
  morgan(':method :url :status :res[content-length] - :response-time ms', {
    stream: { write: (message) => logger.http(message.trim()) },
  })
);

// Populates res.locals.currentUser on every request (or null) so views like
// partials/simpleNav.ejs can render a signed-in nav without every route
// having to enforce authentication. Does not block unauthenticated
// requests — routes that must be protected use verifyJwt individually.
app.use(attachCurrentUser);

// Temporary landing route — replaced by the proper MVC routing structure
// (src/routes) once Event Management and later modules are implemented.
app.get('/', (req, res) => {
  res.render('pages/index', { title: 'CommunityConnect', env: config.nodeEnv });
});

app.use('/', webAuthRoutes);
app.use('/', webDashboardRoutes);

// ---- Centralized error handling (must be registered last) ----
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
