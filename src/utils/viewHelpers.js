const { sanitizeUser } = require('../models/userModel');
const { getNavItems } = require('../config/navigation');
const { getInitials } = require('./format');

// The handful of locals every app-shell page needs (sidebar nav, topbar
// user info, active-link detection). Spread this into every render() call
// that uses layouts/app.ejs instead of repeating the four lines everywhere.
//
// currentPath uses req.originalUrl (with the query string stripped), not
// req.path — req.path is relative to whatever router mount point handled
// the request (e.g. "/5" inside a router mounted at "/admin/events"),
// which would break the sidebar's active-link match against a full path
// like "/admin/events". req.originalUrl is always the full request path
// regardless of nesting.
function getAppShellLocals(req) {
  const user = sanitizeUser(req.user);
  return {
    user,
    initials: getInitials(user.name),
    navItems: getNavItems(user.role),
    currentPath: req.originalUrl.split('?')[0],
  };
}

// Redirects with a one-time flash message carried in the query string —
// see middlewares/flash.js for how the next request picks it up. Reusable
// by any controller in any module that needs a simple "action done, here's
// the result" redirect without a full form to re-render.
function redirectWithFlash(res, path, message, type = 'success') {
  const query = new URLSearchParams({ flash: message, flashType: type }).toString();
  res.redirect(`${path}?${query}`);
}

// Route params are always strings; this rejects anything that isn't a
// plain positive integer (e.g. "5abc", "-1", "abc") instead of letting a
// malformed id reach a SQL query and throw a raw driver error.
function parsePositiveIntParam(value) {
  return /^\d+$/.test(value) ? parseInt(value, 10) : null;
}

module.exports = { getAppShellLocals, redirectWithFlash, parsePositiveIntParam };
