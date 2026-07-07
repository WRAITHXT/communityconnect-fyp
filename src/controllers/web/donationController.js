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

function renderForm(req, res, { errors = [], values = {} } = {}, statusCode = 200) {
  res.status(statusCode).render('pages/donations/form', {
    title: 'Record a Donation - CommunityConnect',
    layout: 'layouts/app',
    ...getAppShellLocals(req),
    breadcrumbs: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'My Donations', href: '/my-donations' },
      { label: 'Record a Donation' },
    ],
    errors,
    values,
  });
}

function showCreateForm(req, res) {
  renderForm(req, res);
}

async function create(req, res, next) {
  try {
    const fieldErrors = validationResult(req)
      .array()
      .map((e) => e.msg);
    if (fieldErrors.length > 0) {
      return renderForm(req, res, { errors: fieldErrors, values: req.body }, 400);
    }

    await donationService.createDonation(req.user.id, req.body);
    redirectWithFlash(res, '/my-donations', 'Donation recorded successfully.', 'success');
  } catch (err) {
    if (err instanceof donationService.DonationError) {
      return renderForm(req, res, { errors: [err.message], values: req.body }, 400);
    }
    next(err);
  }
}

async function myDonations(req, res, next) {
  try {
    const { date, donationType } = req.query;
    const donations = await donationModel.listForUser(req.user.id, {
      date: date || undefined,
      donationType: donationType || undefined,
    });
    const totalAmount = await donationModel.getTotalForUser(req.user.id);

    res.render('pages/donations/my', {
      title: 'My Donations - CommunityConnect',
      layout: 'layouts/app',
      ...getAppShellLocals(req),
      breadcrumbs: [{ label: 'Dashboard', href: '/dashboard' }, { label: 'My Donations' }],
      donations,
      totalAmount,
      filters: { date: date || '', donationType: donationType || '' },
      typeLabels: donationService.DONATION_TYPE_LABELS,
    });
  } catch (err) {
    next(err);
  }
}

async function viewDonation(req, res, next) {
  const donationId = parsePositiveIntParam(req.params.id);
  if (donationId === null) return renderNotFound(req, res);

  try {
    const donation = await donationModel.findById(donationId);
    if (!donation || donation.donor_id !== req.user.id) return renderNotFound(req, res);

    res.render('pages/donations/view', {
      title: 'Donation Details - CommunityConnect',
      layout: 'layouts/app',
      ...getAppShellLocals(req),
      breadcrumbs: [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'My Donations', href: '/my-donations' },
        { label: 'Donation Details' },
      ],
      donation,
      typeLabels: donationService.DONATION_TYPE_LABELS,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { showCreateForm, create, myDonations, viewDonation };
