const attendanceService = require('../../services/attendanceService');
const attendanceModel = require('../../models/attendanceModel');
const registrationModel = require('../../models/registrationModel');
const eventModel = require('../../models/eventModel');
const userModel = require('../../models/userModel');
const {
  getAppShellLocals,
  redirectWithFlash,
  parsePositiveIntParam,
} = require('../../utils/viewHelpers');

function renderNotFound(req, res) {
  return res.status(404).render('pages/error', {
    title: 'Not Found - CommunityConnect',
    status: 404,
    message: 'Not found.',
  });
}

// datetime-local inputs need "YYYY-MM-DDTHH:mm" in the browser's local time.
function toDatetimeLocal(value) {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function list(req, res, next) {
  const eventId = parsePositiveIntParam(req.params.id);
  if (eventId === null) return renderNotFound(req, res);

  try {
    const event = await eventModel.findById(eventId);
    if (!event) return renderNotFound(req, res);

    const roster = await attendanceModel.listForEvent(eventId);
    const stats = await attendanceModel.getEventStats(eventId);

    res.render('pages/admin/events/attendance', {
      title: `Attendance - ${event.title} - CommunityConnect`,
      layout: 'layouts/app',
      ...getAppShellLocals(req),
      breadcrumbs: [
        { label: 'Dashboard', href: '/admin/dashboard' },
        { label: 'Manage Events', href: '/admin/events' },
        { label: event.title, href: `/admin/events/${event.id}` },
        { label: 'Attendance' },
      ],
      event,
      roster,
      stats,
    });
  } catch (err) {
    next(err);
  }
}

function makeAction(serviceFn, successMessage) {
  return async (req, res, next) => {
    const eventId = parsePositiveIntParam(req.params.id);
    const registrationId = parsePositiveIntParam(req.params.registrationId);
    if (eventId === null || registrationId === null) return renderNotFound(req, res);

    try {
      await serviceFn(registrationId, req.user.id);
      redirectWithFlash(res, `/admin/events/${eventId}/attendance`, successMessage, 'success');
    } catch (err) {
      if (err instanceof attendanceService.AttendanceError) {
        return redirectWithFlash(res, `/admin/events/${eventId}/attendance`, err.message, 'error');
      }
      next(err);
    }
  };
}

const checkIn = makeAction(attendanceService.checkIn, 'Volunteer checked in.');
const checkOut = makeAction(attendanceService.checkOut, 'Volunteer checked out.');
const markPresent = makeAction(attendanceService.markPresent, 'Volunteer marked present.');
const markAbsent = makeAction(attendanceService.markAbsent, 'Volunteer marked absent.');

async function showEditForm(req, res, next) {
  const eventId = parsePositiveIntParam(req.params.id);
  const registrationId = parsePositiveIntParam(req.params.registrationId);
  if (eventId === null || registrationId === null) return renderNotFound(req, res);

  try {
    const event = await eventModel.findById(eventId);
    if (!event) return renderNotFound(req, res);

    const registration = await registrationModel.findById(registrationId);
    const attendance = await attendanceModel.findByRegistrationId(registrationId);
    if (!registration || !attendance) return renderNotFound(req, res);

    const volunteer = await userModel.findById(registration.user_id);

    res.render('pages/admin/events/attendanceEdit', {
      title: `Edit Attendance - ${event.title} - CommunityConnect`,
      layout: 'layouts/app',
      ...getAppShellLocals(req),
      breadcrumbs: [
        { label: 'Dashboard', href: '/admin/dashboard' },
        { label: 'Manage Events', href: '/admin/events' },
        { label: event.title, href: `/admin/events/${event.id}` },
        { label: 'Attendance', href: `/admin/events/${event.id}/attendance` },
        { label: 'Edit' },
      ],
      event,
      registrationId,
      volunteerName: volunteer ? volunteer.name : 'Unknown volunteer',
      errors: [],
      values: {
        status: attendance.status,
        checkInTime: toDatetimeLocal(attendance.check_in_time),
        checkOutTime: toDatetimeLocal(attendance.check_out_time),
        hoursContributed: attendance.hours_contributed,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  const eventId = parsePositiveIntParam(req.params.id);
  const registrationId = parsePositiveIntParam(req.params.registrationId);
  if (eventId === null || registrationId === null) return renderNotFound(req, res);

  try {
    await attendanceService.editAttendance(registrationId, req.body, req.user.id);
    redirectWithFlash(
      res,
      `/admin/events/${eventId}/attendance`,
      'Attendance record updated.',
      'success'
    );
  } catch (err) {
    if (err instanceof attendanceService.AttendanceError) {
      const event = await eventModel.findById(eventId);
      const registration = await registrationModel.findById(registrationId);
      const volunteer = registration ? await userModel.findById(registration.user_id) : null;

      return res.status(400).render('pages/admin/events/attendanceEdit', {
        title: `Edit Attendance - ${event ? event.title : ''} - CommunityConnect`,
        layout: 'layouts/app',
        ...getAppShellLocals(req),
        breadcrumbs: [
          { label: 'Dashboard', href: '/admin/dashboard' },
          { label: 'Manage Events', href: '/admin/events' },
          { label: event ? event.title : '', href: `/admin/events/${eventId}` },
          { label: 'Attendance', href: `/admin/events/${eventId}/attendance` },
          { label: 'Edit' },
        ],
        event,
        registrationId,
        volunteerName: volunteer ? volunteer.name : 'Unknown volunteer',
        errors: [err.message],
        values: req.body,
      });
    }
    next(err);
  }
}

module.exports = {
  list,
  checkIn,
  checkOut,
  markPresent,
  markAbsent,
  showEditForm,
  update,
};
