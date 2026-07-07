const dashboardService = require('../../services/dashboardService');
const { getAppShellLocals } = require('../../utils/viewHelpers');

// GET /dashboard — role-aware entry point used by the sidebar/nav's single
// "Dashboard" link. Admins are sent on to the real admin-only route below;
// everyone else sees their own dashboard here.
async function index(req, res, next) {
  if (req.user.role === 'admin') {
    return res.redirect('/admin/dashboard');
  }

  try {
    const cards = await dashboardService.getUserDashboardCards();

    res.render('pages/dashboard/index', {
      title: 'Dashboard - CommunityConnect',
      layout: 'layouts/app',
      ...getAppShellLocals(req),
      breadcrumbs: [{ label: 'Dashboard' }],
      cards,
    });
  } catch (err) {
    next(err);
  }
}

// GET /admin/dashboard — gated by requireRole('admin') in the route
// definition, not just by this controller.
async function adminDashboard(req, res, next) {
  try {
    const stats = await dashboardService.getAdminStats();
    const quickActions = dashboardService.getAdminQuickActions();

    res.render('pages/admin/dashboard', {
      title: 'Admin Dashboard - CommunityConnect',
      layout: 'layouts/app',
      ...getAppShellLocals(req),
      breadcrumbs: [{ label: 'Dashboard' }],
      stats,
      quickActions,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { index, adminDashboard };
