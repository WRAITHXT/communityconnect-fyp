const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

// Populates res.locals.unreadNotificationCount on every request (0 when
// logged out), the same "available in every view without every controller
// passing it" pattern as attachCurrentUser/attachCsrfToken — the sidebar
// partial (partials/sidebar.ejs) needs this on every app-shell page, and
// duplicating a count query into every controller's render call would be
// far more invasive than one global middleware. Must run after
// attachCurrentUser (needs req.user).
//
// A count-query failure here must never break page rendering — the sidebar
// badge is cosmetic, not load-bearing, so any error is logged and treated
// as "no unread notifications" rather than surfaced.
async function attachUnreadNotificationCount(req, res, next) {
  if (!req.user) {
    res.locals.unreadNotificationCount = 0;
    return next();
  }

  try {
    res.locals.unreadNotificationCount = await notificationService.countUnreadForUser(req.user.id);
  } catch (err) {
    logger.error(`Failed to load unread notification count: ${err.message}`);
    res.locals.unreadNotificationCount = 0;
  }
  next();
}

module.exports = { attachUnreadNotificationCount };
