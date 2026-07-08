const path = require('path');
const express = require('express');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const expressLayouts = require('express-ejs-layouts');

const logger = require('./utils/logger');
const storage = require('./utils/storage');
const { formatDate, formatCurrency } = require('./utils/format');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');
const { attachCurrentUser } = require('./middlewares/verifyJwt');
const { attachFlashFromQuery } = require('./middlewares/flash');
const { attachCsrfToken, doubleCsrfProtection, handleCsrfError } = require('./middlewares/csrf');
const webAuthRoutes = require('./routes/web/authRoutes');
const webDashboardRoutes = require('./routes/web/dashboardRoutes');
const webEventRoutes = require('./routes/web/eventRoutes');
const webAdminEventRoutes = require('./routes/web/adminEventRoutes');
const webRegistrationRoutes = require('./routes/web/registrationRoutes');
const webAttendanceRoutes = require('./routes/web/attendanceRoutes');
const webDonationRoutes = require('./routes/web/donationRoutes');
const webAdminDonationRoutes = require('./routes/web/adminDonationRoutes');
const webCertificateRoutes = require('./routes/web/certificateRoutes');
const webAdminCertificateRoutes = require('./routes/web/adminCertificateRoutes');
const webCertificateVerifyRoutes = require('./routes/web/certificateVerifyRoutes');
const webAdminReportRoutes = require('./routes/web/adminReportRoutes');

const app = express();

// ---- View engine (EJS + shared layout) ----
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/simple');
app.use(expressLayouts);

// Shared view helpers available in every template without passing them
// through every render() call — see docs/PHASE4_EVENT_MANAGEMENT.md.
app.locals.getBannerUrl = storage.getPublicUrl;
app.locals.formatDate = formatDate;
app.locals.formatTime = (value) =>
  new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
app.locals.formatCurrency = formatCurrency;

// ---- Secure HTTP headers (Phase 10 hardening) ----
// Every asset this app ever loads is self-hosted (Font Awesome, Chart.js,
// this app's own CSS/JS — no CDN dependency anywhere, see docs/PHASE3/9),
// and no view has an inline <script> or <style> attribute, so the CSP can
// stay at 'self' everywhere without any 'unsafe-inline'. Placed before
// express.static so the headers apply to static assets too, not just
// rendered pages.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
  })
);

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
//
// Registered before the CSRF middlewares below deliberately: every view,
// including the 403 page CSRF failures render, includes simpleNav/topbar,
// which reference `currentUser` — if a bad CSRF token were rejected before
// this ran, res.locals.currentUser would never be set and rendering that
// very error page would itself throw, turning a clean 403 into a raw 500.
app.use(attachCurrentUser);
app.use(attachFlashFromQuery);

// ---- CSRF (Phase 10 hardening) ----
// attachCsrfToken runs on every request so any page with a POST form has a
// token to embed; doubleCsrfProtection only actually validates non-GET/HEAD/
// OPTIONS requests (its default), so GET navigation is unaffected. Both are
// registered after body-parsing/cookies (needs req.body/req.cookies) and
// after express.static (asset requests never reach here at all).
//
// One exception: doubleCsrfProtection is configured to skip
// multipart/form-data requests (the event banner-upload form) — that
// content type is never parsed by express.json/express.urlencoded above, so
// req.body._csrf would always be empty here regardless of what the form
// actually sent. Those routes verify CSRF themselves, after their own
// multer middleware has run — see verifyCsrfAfterUpload in
// middlewares/csrf.js and its use in routes/web/adminEventRoutes.js.
app.use(attachCsrfToken);
app.use(doubleCsrfProtection);

// Public landing page.
app.get('/', (req, res) => {
  res.render('pages/index', { title: 'CommunityConnect' });
});

app.use('/', webAuthRoutes);
// Registered here — before any router below with a blanket router.use(verifyJwt)
// (events/registrations/attendance/donations/certificates all have one) —
// so an unauthenticated visitor's request for the public verification page
// is handled here first, instead of being redirected to /login by one of
// those routers before it ever reaches this one. Same class of mount-order
// issue as the Phase 5 admin-router lesson, just for a public route instead
// of an admin one.
app.use('/', webCertificateVerifyRoutes);
app.use('/', webDashboardRoutes);
app.use('/', webEventRoutes);
app.use('/admin/events', webAdminEventRoutes);
app.use('/', webRegistrationRoutes);
app.use('/', webAttendanceRoutes);
app.use('/', webDonationRoutes);
app.use('/admin/donations', webAdminDonationRoutes);
app.use('/', webCertificateRoutes);
app.use('/admin/certificates', webAdminCertificateRoutes);
app.use('/admin/reports', webAdminReportRoutes);

// ---- Centralized error handling (must be registered last) ----
app.use(notFoundHandler);
app.use(handleCsrfError);
app.use(errorHandler);

module.exports = app;
