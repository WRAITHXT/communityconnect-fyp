const notificationService = require('../../services/notificationService');
const {
  getAppShellLocals,
  redirectWithFlash,
  parsePositiveIntParam,
} = require('../../utils/viewHelpers');

async function list(req, res, next) {
  try {
    const notifications = await notificationService.listForUser(req.user.id);

    res.render('pages/notifications/list', {
      title: 'Notifications - CommunityConnect',
      layout: 'layouts/app',
      ...getAppShellLocals(req),
      breadcrumbs: [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Notifications' }],
      notifications,
    });
  } catch (err) {
    next(err);
  }
}

async function markRead(req, res, next) {
  const notificationId = parsePositiveIntParam(req.params.id);
  if (notificationId === null) {
    return res.status(404).render('pages/error', {
      title: 'Not Found - CommunityConnect',
      status: 404,
      message: 'Notification not found.',
    });
  }

  try {
    await notificationService.markAsRead(notificationId, req.user.id);
    redirectWithFlash(res, '/notifications', 'Notification marked as read.', 'success');
  } catch (err) {
    if (err instanceof notificationService.NotificationError) {
      return redirectWithFlash(res, '/notifications', err.message, 'error');
    }
    next(err);
  }
}

async function markAllRead(req, res, next) {
  try {
    await notificationService.markAllAsRead(req.user.id);
    redirectWithFlash(res, '/notifications', 'All notifications marked as read.', 'success');
  } catch (err) {
    next(err);
  }
}

module.exports = { list, markRead, markAllRead };
