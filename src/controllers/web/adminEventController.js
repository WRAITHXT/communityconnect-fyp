const { validationResult } = require('express-validator');

const eventService = require('../../services/eventService');
const eventModel = require('../../models/eventModel');
const eventCategoryModel = require('../../models/eventCategoryModel');
const { getAppShellLocals } = require('../../utils/viewHelpers');

// Converts a DB event row into the flat field shape the create/edit form
// uses, so pre-filling the edit form works the same way a failed-validation
// re-render pre-fills it (both just set `values`).
function toFormValues(event) {
  const start = new Date(event.start_datetime);
  const end = new Date(event.end_datetime);
  const deadline = new Date(event.registration_deadline);

  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const timeStr = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  return {
    title: event.title,
    description: event.description,
    categoryId: String(event.category_id),
    location: event.location,
    eventDate: dateStr(start),
    startTime: timeStr(start),
    endTime: timeStr(end),
    registrationDeadline: dateStr(deadline),
    capacity: String(event.capacity),
    status: event.status,
  };
}

async function renderForm(
  req,
  res,
  { mode, errors = [], values = {}, eventId = null, eventTitle = null, currentBannerUrl = null }
) {
  const categories = await eventCategoryModel.listAll();
  const breadcrumbs = [
    { label: 'Dashboard', href: '/admin/dashboard' },
    { label: 'Manage Events', href: '/admin/events' },
  ];

  if (mode === 'create') {
    breadcrumbs.push({ label: 'Create Event' });
  } else {
    breadcrumbs.push({ label: eventTitle || 'Event', href: `/admin/events/${eventId}` });
    breadcrumbs.push({ label: 'Edit' });
  }

  res.status(errors.length > 0 ? 400 : 200).render('pages/admin/events/form', {
    title:
      mode === 'create'
        ? 'Create Event - CommunityConnect'
        : `Edit ${eventTitle || 'Event'} - CommunityConnect`,
    layout: 'layouts/app',
    ...getAppShellLocals(req),
    breadcrumbs,
    mode,
    eventId,
    formAction: mode === 'create' ? '/admin/events' : `/admin/events/${eventId}/update`,
    categories,
    errors,
    values,
    currentBannerUrl,
  });
}

function renderNotFound(req, res) {
  return res.status(404).render('pages/error', {
    title: 'Not Found - CommunityConnect',
    status: 404,
    message: 'Event not found.',
  });
}

async function list(req, res, next) {
  try {
    const { search, categoryId, status } = req.query;
    const events = await eventModel.list({
      search: search || undefined,
      categoryId: categoryId ? parseInt(categoryId, 10) : undefined,
      status: status || undefined,
    });
    const categories = await eventCategoryModel.listAll();

    res.render('pages/admin/events/list', {
      title: 'Manage Events - CommunityConnect',
      layout: 'layouts/app',
      ...getAppShellLocals(req),
      breadcrumbs: [{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Manage Events' }],
      events,
      categories,
      filters: { search: search || '', categoryId: categoryId || '', status: status || '' },
    });
  } catch (err) {
    next(err);
  }
}

async function showCreateForm(req, res, next) {
  try {
    await renderForm(req, res, { mode: 'create', values: {} });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const fieldErrors = validationResult(req)
      .array()
      .map((e) => e.msg);
    if (req.uploadError) fieldErrors.unshift(req.uploadError);

    if (fieldErrors.length > 0) {
      return await renderForm(req, res, { mode: 'create', errors: fieldErrors, values: req.body });
    }

    const event = await eventService.createEvent(req.body, req.file, req.user.id);
    res.redirect(`/admin/events/${event.id}`);
  } catch (err) {
    if (err instanceof eventService.EventError) {
      return await renderForm(req, res, {
        mode: 'create',
        errors: [err.message],
        values: req.body,
      });
    }
    next(err);
  }
}

async function view(req, res, next) {
  try {
    const event = await eventModel.findById(req.params.id);
    if (!event) return renderNotFound(req, res);

    res.render('pages/admin/events/view', {
      title: `${event.title} - CommunityConnect`,
      layout: 'layouts/app',
      ...getAppShellLocals(req),
      breadcrumbs: [
        { label: 'Dashboard', href: '/admin/dashboard' },
        { label: 'Manage Events', href: '/admin/events' },
        { label: event.title },
      ],
      event,
    });
  } catch (err) {
    next(err);
  }
}

async function showEditForm(req, res, next) {
  try {
    const event = await eventModel.findById(req.params.id);
    if (!event) return renderNotFound(req, res);

    await renderForm(req, res, {
      mode: 'edit',
      values: toFormValues(event),
      eventId: event.id,
      eventTitle: event.title,
      currentBannerUrl: req.app.locals.getBannerUrl(event.banner_image_key),
    });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const fieldErrors = validationResult(req)
      .array()
      .map((e) => e.msg);
    if (req.uploadError) fieldErrors.unshift(req.uploadError);

    if (fieldErrors.length > 0) {
      const existing = await eventModel.findById(req.params.id);
      return await renderForm(req, res, {
        mode: 'edit',
        errors: fieldErrors,
        values: req.body,
        eventId: req.params.id,
        eventTitle: existing ? existing.title : null,
        currentBannerUrl: existing ? req.app.locals.getBannerUrl(existing.banner_image_key) : null,
      });
    }

    const event = await eventService.updateEvent(req.params.id, req.body, req.file);
    res.redirect(`/admin/events/${event.id}`);
  } catch (err) {
    if (err instanceof eventService.EventError) {
      const existing = await eventModel.findById(req.params.id);
      return await renderForm(req, res, {
        mode: 'edit',
        errors: [err.message],
        values: req.body,
        eventId: req.params.id,
        eventTitle: existing ? existing.title : null,
        currentBannerUrl: existing ? req.app.locals.getBannerUrl(existing.banner_image_key) : null,
      });
    }
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await eventService.deleteEvent(req.params.id);
    res.redirect('/admin/events');
  } catch (err) {
    if (err instanceof eventService.EventError) {
      return renderNotFound(req, res);
    }
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    await eventService.setEventStatus(req.params.id, req.body.status);
    res.redirect('/admin/events');
  } catch (err) {
    if (err instanceof eventService.EventError) {
      return renderNotFound(req, res);
    }
    next(err);
  }
}

module.exports = { list, showCreateForm, create, view, showEditForm, update, remove, updateStatus };
