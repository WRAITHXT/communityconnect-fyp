const registrationService = require('../../services/registrationService');
const registrationModel = require('../../models/registrationModel');
const eventModel = require('../../models/eventModel');
const {
  getAppShellLocals,
  redirectWithFlash,
  parsePositiveIntParam,
} = require('../../utils/viewHelpers');

function renderNotFound(req, res) {
  return res.status(404).render('pages/error', {
    title: 'Not Found - CommunityConnect',
    status: 404,
    message: 'Event not found.',
  });
}

async function list(req, res, next) {
  const eventId = parsePositiveIntParam(req.params.id);
  if (eventId === null) return renderNotFound(req, res);

  try {
    const event = await eventModel.findById(eventId);
    if (!event) return renderNotFound(req, res);

    const { search } = req.query;
    const registrations = await registrationModel.listForEvent(eventId, {
      search: search || undefined,
    });
    const stats = await registrationModel.getEventStats(eventId);

    res.render('pages/admin/events/volunteers', {
      title: `Volunteers - ${event.title} - CommunityConnect`,
      layout: 'layouts/app',
      ...getAppShellLocals(req),
      breadcrumbs: [
        { label: 'Dashboard', href: '/admin/dashboard' },
        { label: 'Manage Events', href: '/admin/events' },
        { label: event.title, href: `/admin/events/${event.id}` },
        { label: 'Volunteers' },
      ],
      event,
      registrations,
      stats,
      filters: { search: search || '' },
    });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  const eventId = parsePositiveIntParam(req.params.id);
  const registrationId = parsePositiveIntParam(req.params.registrationId);
  if (eventId === null || registrationId === null) return renderNotFound(req, res);

  try {
    await registrationService.adminRemoveRegistration(registrationId, req.user.id);
    redirectWithFlash(
      res,
      `/admin/events/${eventId}/volunteers`,
      'Volunteer registration removed.',
      'success'
    );
  } catch (err) {
    if (err instanceof registrationService.RegistrationError) {
      return redirectWithFlash(res, `/admin/events/${eventId}/volunteers`, err.message, 'error');
    }
    next(err);
  }
}

module.exports = { list, remove };
