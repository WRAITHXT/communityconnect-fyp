const registrationService = require('../../services/registrationService');
const registrationModel = require('../../models/registrationModel');
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

async function register(req, res, next) {
  const eventId = parsePositiveIntParam(req.params.id);
  if (eventId === null) return renderNotFound(req, res);

  try {
    await registrationService.registerForEvent(eventId, req.user.id);
    redirectWithFlash(
      res,
      `/events/${eventId}`,
      'You have successfully registered for this event.',
      'success'
    );
  } catch (err) {
    if (err instanceof registrationService.RegistrationError) {
      return redirectWithFlash(res, `/events/${eventId}`, err.message, 'error');
    }
    next(err);
  }
}

async function cancel(req, res, next) {
  const eventId = parsePositiveIntParam(req.params.id);
  if (eventId === null) return renderNotFound(req, res);

  try {
    await registrationService.cancelRegistration(eventId, req.user.id);
    redirectWithFlash(res, '/my-registrations', 'Your registration has been cancelled.', 'success');
  } catch (err) {
    if (err instanceof registrationService.RegistrationError) {
      return redirectWithFlash(res, '/my-registrations', err.message, 'error');
    }
    next(err);
  }
}

async function myRegistrations(req, res, next) {
  try {
    const registrations = await registrationModel.listForUser(req.user.id);

    res.render('pages/registrations/my', {
      title: 'My Registered Events - CommunityConnect',
      layout: 'layouts/app',
      ...getAppShellLocals(req),
      breadcrumbs: [{ label: 'Dashboard', href: '/dashboard' }, { label: 'My Registered Events' }],
      registrations,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, cancel, myRegistrations };
