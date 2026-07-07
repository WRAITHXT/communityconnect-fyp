const donationModel = require('../models/donationModel');

class DonationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DonationError';
    this.code = code;
  }
}

const VALID_TYPES = ['monetary', 'food', 'clothing', 'medical_supplies', 'other'];
const VALID_STATUSES = ['completed', 'pending', 'cancelled'];

const DONATION_TYPE_LABELS = {
  monetary: 'Monetary Donation',
  food: 'Food Donation',
  clothing: 'Clothing Donation',
  medical_supplies: 'Medical Supplies',
  other: 'Other',
};

// Shared field parsing for both create (donor) and update (admin). Cross-
// field rule lives here, not in the validators: amount is only mandatory
// when donationType is 'monetary' (system requirement #3).
function parseCommonFields(body) {
  if (!VALID_TYPES.includes(body.donationType)) {
    throw new DonationError('INVALID_TYPE', 'Please select a valid donation type.');
  }

  const description = (body.description || '').trim();
  if (!description) {
    throw new DonationError('INVALID_DESCRIPTION', 'Description is required.');
  }

  if (!body.donatedAt) {
    throw new DonationError('INVALID_DATE', 'Donation date is required.');
  }
  const donatedAt = new Date(body.donatedAt);
  if (Number.isNaN(donatedAt.getTime())) {
    throw new DonationError('INVALID_DATE', 'Invalid donation date.');
  }

  let amount = null;
  if (body.amount !== undefined && body.amount !== null && String(body.amount).trim() !== '') {
    amount = parseFloat(body.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      throw new DonationError('INVALID_AMOUNT', 'Amount must be a positive number.');
    }
  }

  if (body.donationType === 'monetary' && amount === null) {
    throw new DonationError('INVALID_AMOUNT', 'Amount is required for monetary donations.');
  }

  return { donationType: body.donationType, description, donatedAt, amount };
}

// Donor-facing: a self-reported donation always starts 'pending' — an
// admin later confirms it (Completed) or reverses it (Cancelled) via Edit.
// The donor's own form has no status field at all; nothing in `body` can
// change this.
async function createDonation(donorId, body) {
  const fields = parseCommonFields(body);
  return donationModel.create({ ...fields, donorId, status: 'pending' });
}

// Admin-facing correction/verification path — full control over status.
async function updateDonation(id, body) {
  const existing = await donationModel.findById(id);
  if (!existing) {
    throw new DonationError('NOT_FOUND', 'Donation not found.');
  }

  const fields = parseCommonFields(body);

  if (!VALID_STATUSES.includes(body.status)) {
    throw new DonationError('INVALID_STATUS', 'Please select a valid status.');
  }

  return donationModel.update(id, { ...fields, status: body.status });
}

async function deleteDonation(id) {
  const existing = await donationModel.findById(id);
  if (!existing) {
    throw new DonationError('NOT_FOUND', 'Donation not found.');
  }
  await donationModel.remove(id);
}

module.exports = {
  DonationError,
  VALID_TYPES,
  VALID_STATUSES,
  DONATION_TYPE_LABELS,
  createDonation,
  updateDonation,
  deleteDonation,
};
