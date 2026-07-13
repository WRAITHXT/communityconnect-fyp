const registrationModel = require('../models/registrationModel');
const eventModel = require('../models/eventModel');
const notificationService = require('./notificationService');

class RegistrationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RegistrationError';
    this.code = code;
  }
}

// Sequential check-then-write, not a DB transaction with row locking — for
// this app's scale/demo purposes that's an acceptable simplification (the
// UNIQUE(event_id, user_id) constraint still guarantees no duplicate row
// can ever exist even if two requests race). A production system serving
// real concurrent signups would want SELECT ... FOR UPDATE here.
async function registerForEvent(eventId, userId) {
  const event = await eventModel.findById(eventId);
  if (!event || event.status !== 'published') {
    throw new RegistrationError('EVENT_NOT_AVAILABLE', 'This event is not open for registration.');
  }

  if (new Date(event.registration_deadline) < new Date()) {
    throw new RegistrationError('DEADLINE_PASSED', 'Registration is closed for this event.');
  }

  // Duplicate check runs before the capacity check: if this user is the one
  // occupying the last slot, "you're already registered" is the correct,
  // non-confusing message — not "event full" (which would wrongly suggest
  // someone else took the spot).
  const existing = await registrationModel.findByEventAndUser(eventId, userId);
  if (existing && existing.status === 'approved') {
    throw new RegistrationError('DUPLICATE', 'You are already registered for this event.');
  }

  if (event.remaining_slots <= 0) {
    throw new RegistrationError('EVENT_FULL', 'This event has reached its maximum capacity.');
  }

  if (existing && existing.status === 'withdrawn') {
    const reactivated = await registrationModel.reactivate(existing.id);
    await notificationService.notifyRegistrationSuccess(userId, event.title, event.id);
    return reactivated;
  }

  const registration = await registrationModel.create(eventId, userId);
  await notificationService.notifyRegistrationSuccess(userId, event.title, event.id);
  return registration;
}

// Volunteer-initiated cancellation — only allowed on their own active
// registration, and only before the registration deadline (per this
// phase's instructions; after the deadline the roster is considered
// locked in from the volunteer's side — an admin can still remove them).
async function cancelRegistration(eventId, userId) {
  const event = await eventModel.findById(eventId);
  if (!event) {
    throw new RegistrationError('NOT_FOUND', 'Event not found.');
  }

  const existing = await registrationModel.findByEventAndUser(eventId, userId);
  if (!existing || existing.status !== 'approved') {
    throw new RegistrationError(
      'NOT_REGISTERED',
      'You do not have an active registration for this event.'
    );
  }

  if (new Date(event.registration_deadline) < new Date()) {
    throw new RegistrationError(
      'DEADLINE_PASSED',
      'You can no longer cancel — the registration deadline has passed.'
    );
  }

  return registrationModel.withdraw(existing.id, null);
}

// Admin-initiated removal — not deadline-gated (admins can manage the
// roster at any time), and records who removed it via decided_by.
async function adminRemoveRegistration(registrationId, adminId) {
  const registration = await registrationModel.findById(registrationId);
  if (!registration || registration.status !== 'approved') {
    throw new RegistrationError('NOT_FOUND', 'Active registration not found.');
  }

  return registrationModel.withdraw(registrationId, adminId);
}

// Badge state for the event detail page, from the viewing user's
// perspective: 'registered' if they have an active registration;
// otherwise 'closed'/'full' if registration isn't currently possible; or
// null if registration is open (show the Register button — this also
// covers a user who previously withdrew and could re-register).
function getViewerRegistrationStatus(event, registration) {
  if (registration && registration.status === 'approved') {
    return 'registered';
  }
  if (new Date(event.registration_deadline) < new Date()) {
    return 'closed';
  }
  if (event.remaining_slots <= 0) {
    return 'full';
  }
  return null;
}

module.exports = {
  RegistrationError,
  registerForEvent,
  cancelRegistration,
  adminRemoveRegistration,
  getViewerRegistrationStatus,
};
