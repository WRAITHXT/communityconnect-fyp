const { sanitizeUser } = require('../models/userModel');
const { getNavItems } = require('../config/navigation');
const { getInitials } = require('./format');

// The handful of locals every app-shell page needs (sidebar nav, topbar
// user info, active-link detection). Spread this into every render() call
// that uses layouts/app.ejs instead of repeating the four lines everywhere.
function getAppShellLocals(req) {
  const user = sanitizeUser(req.user);
  return {
    user,
    initials: getInitials(user.name),
    navItems: getNavItems(user.role),
    currentPath: req.path,
  };
}

module.exports = { getAppShellLocals };
