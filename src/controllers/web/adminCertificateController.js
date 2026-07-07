const certificateService = require('../../services/certificateService');
const certificateModel = require('../../models/certificateModel');
const pdfGenerator = require('../../utils/pdfGenerator');
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
    message: 'Not found.',
  });
}

// Per-event roster: every volunteer eligible for a certificate (approved +
// marked Present), each with a Generate button or a link to their already-
// issued certificate. Mirrors the attendance roster page's shape and lives
// under /admin/events/:id/certificates for the same reason attendance does
// — the action only makes sense in the context of one specific event.
async function eventRoster(req, res, next) {
  const eventId = parsePositiveIntParam(req.params.id);
  if (eventId === null) return renderNotFound(req, res);

  try {
    const event = await eventModel.findById(eventId);
    if (!event) return renderNotFound(req, res);

    const roster = await certificateModel.listEligibleForEvent(eventId);

    res.render('pages/admin/events/certificates', {
      title: `Certificates - ${event.title} - CommunityConnect`,
      layout: 'layouts/app',
      ...getAppShellLocals(req),
      breadcrumbs: [
        { label: 'Dashboard', href: '/admin/dashboard' },
        { label: 'Manage Events', href: '/admin/events' },
        { label: event.title, href: `/admin/events/${event.id}` },
        { label: 'Certificates' },
      ],
      event,
      roster,
    });
  } catch (err) {
    next(err);
  }
}

async function generate(req, res, next) {
  const eventId = parsePositiveIntParam(req.params.id);
  const registrationId = parsePositiveIntParam(req.params.registrationId);
  if (eventId === null || registrationId === null) return renderNotFound(req, res);

  try {
    await certificateService.generateCertificate(registrationId, req.user.id);
    redirectWithFlash(
      res,
      `/admin/events/${eventId}/certificates`,
      'Certificate generated.',
      'success'
    );
  } catch (err) {
    if (err instanceof certificateService.CertificateError) {
      return redirectWithFlash(res, `/admin/events/${eventId}/certificates`, err.message, 'error');
    }
    next(err);
  }
}

// Global list — admin feature #3/#4/#5: view all, search by volunteer
// name/event/certificate ID (one free-text box, same resolution as Phase
// 7's donation search), filter by event and issue date.
async function list(req, res, next) {
  try {
    const { search, eventId, date } = req.query;
    const certificates = await certificateModel.list({
      search: search || undefined,
      eventId: eventId || undefined,
      date: date || undefined,
    });
    const events = await eventModel.list({});
    const totalCertificates = await certificateModel.countAll();

    res.render('pages/admin/certificates/list', {
      title: 'Manage Certificates - CommunityConnect',
      layout: 'layouts/app',
      ...getAppShellLocals(req),
      breadcrumbs: [{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Certificates' }],
      certificates,
      events,
      totalCertificates,
      filters: { search: search || '', eventId: eventId || '', date: date || '' },
    });
  } catch (err) {
    next(err);
  }
}

async function view(req, res, next) {
  const certificateId = parsePositiveIntParam(req.params.id);
  if (certificateId === null) return renderNotFound(req, res);

  try {
    const certificate = await certificateModel.findById(certificateId);
    if (!certificate) return renderNotFound(req, res);

    res.render('pages/admin/certificates/view', {
      title: 'Certificate Details - CommunityConnect',
      layout: 'layouts/app',
      ...getAppShellLocals(req),
      breadcrumbs: [
        { label: 'Dashboard', href: '/admin/dashboard' },
        { label: 'Certificates', href: '/admin/certificates' },
        { label: 'Certificate Details' },
      ],
      certificate,
    });
  } catch (err) {
    next(err);
  }
}

async function download(req, res, next) {
  const certificateId = parsePositiveIntParam(req.params.id);
  if (certificateId === null) return renderNotFound(req, res);

  try {
    const certificate = await certificateModel.findById(certificateId);
    if (!certificate) return renderNotFound(req, res);

    pdfGenerator.streamCertificatePdf(res, certificate);
  } catch (err) {
    next(err);
  }
}

async function regenerate(req, res, next) {
  const certificateId = parsePositiveIntParam(req.params.id);
  if (certificateId === null) return renderNotFound(req, res);

  try {
    await certificateService.regenerateCertificate(certificateId, req.user.id);
    redirectWithFlash(res, '/admin/certificates', 'Certificate regenerated.', 'success');
  } catch (err) {
    if (err instanceof certificateService.CertificateError) {
      return redirectWithFlash(res, '/admin/certificates', err.message, 'error');
    }
    next(err);
  }
}

async function revoke(req, res, next) {
  const certificateId = parsePositiveIntParam(req.params.id);
  if (certificateId === null) return renderNotFound(req, res);

  try {
    await certificateService.revokeCertificate(certificateId, req.user.id);
    redirectWithFlash(res, '/admin/certificates', 'Certificate revoked.', 'success');
  } catch (err) {
    if (err instanceof certificateService.CertificateError) {
      return redirectWithFlash(res, '/admin/certificates', err.message, 'error');
    }
    next(err);
  }
}

module.exports = { eventRoster, generate, list, view, download, regenerate, revoke };
