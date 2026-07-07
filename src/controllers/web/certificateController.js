const certificateModel = require('../../models/certificateModel');
const pdfGenerator = require('../../utils/pdfGenerator');
const { getAppShellLocals, parsePositiveIntParam } = require('../../utils/viewHelpers');

function renderNotFound(req, res) {
  return res.status(404).render('pages/error', {
    title: 'Not Found - CommunityConnect',
    status: 404,
    message: 'Certificate not found.',
  });
}

async function myCertificates(req, res, next) {
  try {
    const certificates = await certificateModel.listForUser(req.user.id);

    res.render('pages/certificates/my', {
      title: 'My Certificates - CommunityConnect',
      layout: 'layouts/app',
      ...getAppShellLocals(req),
      breadcrumbs: [{ label: 'Dashboard', href: '/dashboard' }, { label: 'My Certificates' }],
      certificates,
    });
  } catch (err) {
    next(err);
  }
}

// Ownership-checked (404, not 403, so a guessed id doesn't confirm a
// certificate exists) — same pattern as donationController.viewDonation.
async function view(req, res, next) {
  const certificateId = parsePositiveIntParam(req.params.id);
  if (certificateId === null) return renderNotFound(req, res);

  try {
    const certificate = await certificateModel.findById(certificateId);
    if (!certificate || certificate.user_id !== req.user.id) return renderNotFound(req, res);

    res.render('pages/certificates/view', {
      title: 'Certificate Details - CommunityConnect',
      layout: 'layouts/app',
      ...getAppShellLocals(req),
      breadcrumbs: [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'My Certificates', href: '/my-certificates' },
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
    if (!certificate || certificate.user_id !== req.user.id) return renderNotFound(req, res);

    pdfGenerator.streamCertificatePdf(res, certificate);
  } catch (err) {
    next(err);
  }
}

module.exports = { myCertificates, view, download };
