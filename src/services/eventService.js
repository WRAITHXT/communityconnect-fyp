const fs = require('fs');
const path = require('path');

const eventModel = require('../models/eventModel');
const eventCategoryModel = require('../models/eventCategoryModel');

const VALID_STATUSES = ['draft', 'published', 'closed'];

class EventError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'EventError';
    this.code = code;
  }
}

function combineDateAndTime(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}:00`);
}

// Cross-field business rules that don't fit a single express-validator
// field rule: category must actually exist, the combined date/time values
// must be real, end must be after start, and the registration deadline
// must not be after the event starts. The DB has matching CHECK
// constraints (defense in depth) — this just gives a friendlier error
// before ever reaching the database.
async function buildEventInput(body) {
  const categoryId = parseInt(body.categoryId, 10);
  const categories = await eventCategoryModel.listAll();
  if (!categories.some((category) => category.id === categoryId)) {
    throw new EventError('INVALID_CATEGORY', 'Please select a valid category.');
  }

  const startDatetime = combineDateAndTime(body.eventDate, body.startTime);
  const endDatetime = combineDateAndTime(body.eventDate, body.endTime);
  const registrationDeadline = new Date(`${body.registrationDeadline}T23:59:59`);

  if (
    Number.isNaN(startDatetime.getTime()) ||
    Number.isNaN(endDatetime.getTime()) ||
    Number.isNaN(registrationDeadline.getTime())
  ) {
    throw new EventError('INVALID_DATES', 'One or more dates or times are invalid.');
  }

  if (endDatetime <= startDatetime) {
    throw new EventError('INVALID_DATES', 'End time must be after the start time.');
  }

  if (registrationDeadline > startDatetime) {
    throw new EventError(
      'INVALID_DATES',
      'Registration deadline must be on or before the event start date.'
    );
  }

  if (!VALID_STATUSES.includes(body.status)) {
    throw new EventError('INVALID_STATUS', 'Please select a valid status.');
  }

  const capacity = parseInt(body.capacity, 10);
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new EventError('INVALID_CAPACITY', 'Capacity must be a positive whole number.');
  }

  return {
    categoryId,
    title: body.title.trim(),
    description: body.description.trim(),
    location: body.location.trim(),
    startDatetime,
    endDatetime,
    registrationDeadline,
    capacity,
    status: body.status,
  };
}

// Best-effort cleanup — a missing/already-removed file must never fail the
// request that triggered it (a delete or a banner replacement).
function removeBannerFile(bannerImageKey) {
  if (!bannerImageKey) return;
  const filePath = path.join(__dirname, '../public', bannerImageKey);
  fs.unlink(filePath, () => {});
}

async function createEvent(body, file, createdBy) {
  const input = await buildEventInput(body);
  const bannerImageKey = file ? `uploads/events/${file.filename}` : null;

  return eventModel.create({ ...input, bannerImageKey, createdBy });
}

async function updateEvent(id, body, file) {
  const existing = await eventModel.findById(id);
  if (!existing) {
    throw new EventError('NOT_FOUND', 'Event not found.');
  }

  const input = await buildEventInput(body);
  let bannerImageKey = existing.banner_image_key;

  if (file) {
    bannerImageKey = `uploads/events/${file.filename}`;
    removeBannerFile(existing.banner_image_key);
  }

  return eventModel.update(id, { ...input, bannerImageKey });
}

async function deleteEvent(id) {
  const existing = await eventModel.findById(id);
  if (!existing) {
    throw new EventError('NOT_FOUND', 'Event not found.');
  }

  await eventModel.remove(id);
  removeBannerFile(existing.banner_image_key);
}

async function setEventStatus(id, status) {
  if (!VALID_STATUSES.includes(status)) {
    throw new EventError('INVALID_STATUS', 'Please select a valid status.');
  }

  const updated = await eventModel.updateStatus(id, status);
  if (!updated) {
    throw new EventError('NOT_FOUND', 'Event not found.');
  }
  return updated;
}

module.exports = {
  EventError,
  createEvent,
  updateEvent,
  deleteEvent,
  setEventStatus,
};
