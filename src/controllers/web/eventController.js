const eventModel = require('../../models/eventModel');
const eventCategoryModel = require('../../models/eventCategoryModel');
const registrationModel = require('../../models/registrationModel');
const registrationService = require('../../services/registrationService');
const { getAppShellLocals, parsePositiveIntParam } = require('../../utils/viewHelpers');

// Users only ever browse published/closed events — draft events never
// appear here, regardless of what a client sends as a status filter (see
// eventModel.list's publicOnly flag, which is always true for this route).
const VALID_PUBLIC_STATUSES = ['published', 'closed'];

function renderNotFound(req, res) {
  return res.status(404).render('pages/error', {
    title: 'Not Found - CommunityConnect',
    status: 404,
    message: 'Event not found.',
  });
}

async function browseEvents(req, res, next) {
  try {
    const { search, categoryId, date, status } = req.query;
    const safeStatus = VALID_PUBLIC_STATUSES.includes(status) ? status : undefined;

    const events = await eventModel.list({
      publicOnly: true,
      search: search || undefined,
      categoryId: categoryId ? parseInt(categoryId, 10) : undefined,
      date: date || undefined,
      status: safeStatus,
    });
    const categories = await eventCategoryModel.listAll();

    res.render('pages/events/list', {
      title: 'Events - CommunityConnect',
      layout: 'layouts/app',
      ...getAppShellLocals(req),
      breadcrumbs: [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Events' }],
      events,
      categories,
      filters: {
        search: search || '',
        categoryId: categoryId || '',
        date: date || '',
        status: status || '',
      },
    });
  } catch (err) {
    next(err);
  }
}

async function viewEvent(req, res, next) {
  const eventId = parsePositiveIntParam(req.params.id);
  if (eventId === null) return renderNotFound(req, res);

  try {
    const event = await eventModel.findById(eventId);
    if (!event || !VALID_PUBLIC_STATUSES.includes(event.status)) {
      return renderNotFound(req, res);
    }

    const registration = await registrationModel.findByEventAndUser(eventId, req.user.id);
    const regStatus = registrationService.getViewerRegistrationStatus(event, registration);

    res.render('pages/events/view', {
      title: `${event.title} - CommunityConnect`,
      layout: 'layouts/app',
      ...getAppShellLocals(req),
      breadcrumbs: [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Events', href: '/events' },
        { label: event.title },
      ],
      event,
      regStatus,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { browseEvents, viewEvent };
