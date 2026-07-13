const notificationModel = require('../models/notificationModel');
const logger = require('../utils/logger');

class NotificationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'NotificationError';
    this.code = code;
  }
}

// Every "notify on success" call below goes through this. Notifications are
// explicitly a secondary feature (see the four notifyX functions' callers
// in registrationService/attendanceService/certificateService/
// donationService): the primary operation they're attached to must succeed
// even if this fails, so the error is logged and swallowed here rather than
// thrown — callers never need their own try/catch around a notifyX call.
async function createNotificationSafe({ userId, title, message, type, targetUrl = null }) {
  try {
    return await notificationModel.create({ userId, title, message, type, targetUrl });
  } catch (err) {
    logger.error(`Failed to create notification (type=${type}, userId=${userId}): ${err.message}`);
    return null;
  }
}

// eventId is expected (registration always has a real event behind it), but
// this degrades to no destination rather than storing a broken link if it's
// ever missing — the notification itself must still be created either way.
function notifyRegistrationSuccess(userId, eventTitle, eventId) {
  return createNotificationSafe({
    userId,
    title: 'Registration Successful',
    message: `You have successfully registered for "${eventTitle}".`,
    type: 'registration',
    targetUrl: eventId ? `/events/${eventId}` : null,
  });
}

// "My Volunteer Hours" (/my-attendance) is the page that actually shows
// check-in/check-out times and hours per event — the most relevant
// destination for this notification, per the task's own "or the most
// appropriate page showing the attendance information" allowance.
function notifyAttendanceRecorded(userId, eventTitle) {
  return createNotificationSafe({
    userId,
    title: 'Attendance Recorded',
    message: `Your attendance has been recorded for "${eventTitle}".`,
    type: 'attendance',
    targetUrl: '/my-attendance',
  });
}

function notifyCertificateGenerated(userId, certificateId) {
  return createNotificationSafe({
    userId,
    title: 'Certificate Available',
    message: 'Your volunteer certificate is ready for download.',
    type: 'certificate',
    targetUrl: certificateId ? `/certificates/${certificateId}` : null,
  });
}

function notifyDonationStatusUpdated(userId, status, donationId) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return createNotificationSafe({
    userId,
    title: 'Donation Updated',
    message: `Your donation status has been updated to ${label}.`,
    type: 'donation',
    targetUrl: donationId ? `/donations/${donationId}` : null,
  });
}

// ---- Reader-side API for the Notifications page (src/routes/web/notificationRoutes.js) ----

function listForUser(userId) {
  return notificationModel.listForUser(userId);
}

function countUnreadForUser(userId) {
  return notificationModel.countUnreadForUser(userId);
}

// Ownership-checked: a user can only mark their own notification as read,
// not any row by guessing an id.
async function markAsRead(notificationId, userId) {
  const notification = await notificationModel.findById(notificationId);
  if (!notification || notification.user_id !== userId) {
    throw new NotificationError('NOT_FOUND', 'Notification not found.');
  }
  return notificationModel.markAsRead(notificationId);
}

function markAllAsRead(userId) {
  return notificationModel.markAllAsReadForUser(userId);
}

module.exports = {
  NotificationError,
  notifyRegistrationSuccess,
  notifyAttendanceRecorded,
  notifyCertificateGenerated,
  notifyDonationStatusUpdated,
  listForUser,
  countUnreadForUser,
  markAsRead,
  markAllAsRead,
};
