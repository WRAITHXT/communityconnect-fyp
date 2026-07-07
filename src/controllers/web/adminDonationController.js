const { validationResult } = require('express-validator');

const donationService = require('../../services/donationService');
const donationModel = require('../../models/donationModel');
const {
  getAppShellLocals,
  redirectWithFlash,
  parsePositiveIntParam,
} = require('../../utils/viewHelpers');

function renderNotFound(req, res) {
  return res.status(404).render('pages/error', {
    title: 'Not Found - CommunityConnect',
    status: 404,
    message: 'Donation not found.',
  });
}

async function list(req, res, next) {
  try {
    const { search, donationType, date, status } = req.query;
    const donations = await donationModel.list({
      search: search || undefined,
      donationType: donationType || undefined,
      date: date || undefined,
      status: status || undefined,
    });
    const stats = await donationModel.getAdminStats();
    const summaryByType = await donationModel.getSummaryByType();

    res.render('pages/admin/donations/list', {
      title: 'Manage Donations - CommunityConnect',
      layout: 'layouts/app',
      ...getAppShellLocals(req),
      breadcrumbs: [{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Donations' }],
      donations,
      stats,
      summaryByType,
      filters: {
        search: search || '',
        donationType: donationType || '',
        date: date || '',
        status: status || '',
      },
      typeLabels: donationService.DONATION_TYPE_LABELS,
    });
  } catch (err) {
    next(err);
  }
}

function renderEditForm(req, res, { donation, errors = [], values }, statusCode = 200) {
  res.status(statusCode).render('pages/admin/donations/edit', {
    title: 'Edit Donation - CommunityConnect',
    layout: 'layouts/app',
    ...getAppShellLocals(req),
    breadcrumbs: [
      { label: 'Dashboard', href: '/admin/dashboard' },
      { label: 'Donations', href: '/admin/donations' },
      { label: 'Edit' },
    ],
    donationId: donation.id,
    donorName: donation.donor_name,
    errors,
    values,
  });
}

function toFormValues(donation) {
  return {
    donationType: donation.donation_type,
    amount: donation.amount,
    description: donation.description,
    donatedAt: new Date(donation.donated_at).toISOString().slice(0, 10),
    status: donation.status,
  };
}

async function showEditForm(req, res, next) {
  const donationId = parsePositiveIntParam(req.params.id);
  if (donationId === null) return renderNotFound(req, res);

  try {
    const donation = await donationModel.findById(donationId);
    if (!donation) return renderNotFound(req, res);

    renderEditForm(req, res, { donation, values: toFormValues(donation) });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  const donationId = parsePositiveIntParam(req.params.id);
  if (donationId === null) return renderNotFound(req, res);

  try {
    const fieldErrors = validationResult(req)
      .array()
      .map((e) => e.msg);

    if (fieldErrors.length > 0) {
      const donation = await donationModel.findById(donationId);
      if (!donation) return renderNotFound(req, res);
      return renderEditForm(req, res, { donation, errors: fieldErrors, values: req.body }, 400);
    }

    await donationService.updateDonation(donationId, req.body);
    redirectWithFlash(res, '/admin/donations', 'Donation record updated.', 'success');
  } catch (err) {
    if (err instanceof donationService.DonationError) {
      const donation = await donationModel.findById(donationId);
      if (!donation) return renderNotFound(req, res);
      return renderEditForm(req, res, { donation, errors: [err.message], values: req.body }, 400);
    }
    next(err);
  }
}

async function remove(req, res, next) {
  const donationId = parsePositiveIntParam(req.params.id);
  if (donationId === null) return renderNotFound(req, res);

  try {
    await donationService.deleteDonation(donationId);
    redirectWithFlash(res, '/admin/donations', 'Donation record deleted.', 'success');
  } catch (err) {
    if (err instanceof donationService.DonationError) {
      return redirectWithFlash(res, '/admin/donations', err.message, 'error');
    }
    next(err);
  }
}

module.exports = { list, showEditForm, update, remove };
