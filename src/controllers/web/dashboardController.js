const dashboardService = require('../../services/dashboardService');
const { sanitizeUser } = require('../../models/userModel');
const { getNavItems } = require('../../config/navigation');
const { getInitials } = require('../../utils/format');

// GET /dashboard — role-aware entry point used by the sidebar/nav's single
// "Dashboard" link. Admins are sent on to the real admin-only route below;
// everyone else sees their own dashboard here.
function index(req, res) {
  if (req.user.role === 'admin') {
    return res.redirect('/admin/dashboard');
  }

  const user = sanitizeUser(req.user);
  const cards = dashboardService.getUserDashboardCards();

  res.render('pages/dashboard/index', {
    title: 'Dashboard - CommunityConnect',
    layout: 'layouts/app',
    user,
    initials: getInitials(user.name),
    navItems: getNavItems(user.role),
    currentPath: req.path,
    breadcrumbs: [{ label: 'Dashboard' }],
    cards,
  });
}

// GET /admin/dashboard — gated by requireRole('admin') in the route
// definition, not just by this controller.
async function adminDashboard(req, res, next) {
  try {
    const user = sanitizeUser(req.user);
    const stats = await dashboardService.getAdminStats();
    const quickActions = dashboardService.getAdminQuickActions();

    res.render('pages/admin/dashboard', {
      title: 'Admin Dashboard - CommunityConnect',
      layout: 'layouts/app',
      user,
      initials: getInitials(user.name),
      navItems: getNavItems(user.role),
      currentPath: req.path,
      breadcrumbs: [{ label: 'Dashboard' }],
      stats,
      quickActions,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { index, adminDashboard };
