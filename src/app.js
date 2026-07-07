const path = require('path');
const express = require('express');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const expressLayouts = require('express-ejs-layouts');

const config = require('./config/env');
const logger = require('./utils/logger');
const storage = require('./utils/storage');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');
const { attachCurrentUser } = require('./middlewares/verifyJwt');
const webAuthRoutes = require('./routes/web/authRoutes');
const webDashboardRoutes = require('./routes/web/dashboardRoutes');
const webEventRoutes = require('./routes/web/eventRoutes');
const webAdminEventRoutes = require('./routes/web/adminEventRoutes');

const app = express();

// ---- View engine (EJS + shared layout) ----
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/simple');
app.use(expressLayouts);

// Shared view helpers available in every template without passing them
// through every render() call — see docs/PHASE4_EVENT_MANAGEMENT.md.
app.locals.getBannerUrl = storage.getPublicUrl;
app.locals.formatDate = (value) =>
  new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
app.locals.formatTime = (value) =>
  new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

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
// (src/routes) once more modules are implemented.
app.get('/', (req, res) => {
  res.render('pages/index', { title: 'CommunityConnect', env: config.nodeEnv });
});

app.use('/', webAuthRoutes);
app.use('/', webDashboardRoutes);
app.use('/', webEventRoutes);
app.use('/', webAdminEventRoutes);

// ---- Centralized error handling (must be registered last) ----
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
