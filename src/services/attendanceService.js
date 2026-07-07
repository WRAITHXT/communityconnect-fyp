const attendanceModel = require('../models/attendanceModel');
const registrationModel = require('../models/registrationModel');
const eventModel = require('../models/eventModel');

const UNIQUE_VIOLATION = '23505';
const VALID_STATUSES = ['attended', 'no_show'];

class AttendanceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AttendanceError';
    this.code = code;
  }
}

function computeHours(start, end) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const hours = ms / (1000 * 60 * 60);
  return Math.max(0, Math.round(hours * 100) / 100);
}

// System requirement #1: only currently-registered (approved) volunteers
// may have attendance recorded.
async function assertActiveRegistration(eventRegistrationId) {
  const registration = await registrationModel.findById(eventRegistrationId);
  if (!registration || registration.status !== 'approved') {
    throw new AttendanceError(
      'NOT_REGISTERED',
      'Only currently registered volunteers can have attendance recorded.'
    );
  }
  return registration;
}

async function assertNotAlreadyRecorded(eventRegistrationId) {
  const existing = await attendanceModel.findByRegistrationId(eventRegistrationId);
  if (existing) {
    throw new AttendanceError(
      'ALREADY_RECORDED',
      'Attendance has already been recorded for this volunteer. Use Edit to make corrections.'
    );
  }
}

async function checkIn(eventRegistrationId, adminId) {
  await assertActiveRegistration(eventRegistrationId);
  await assertNotAlreadyRecorded(eventRegistrationId);

  try {
    return await attendanceModel.checkIn(eventRegistrationId, adminId);
  } catch (err) {
    // Safety net for a race between the check above and the insert — the
    // attendance table's UNIQUE(event_registration_id) constraint is the
    // real guarantee (system requirement #2/#3).
    if (err.code === UNIQUE_VIOLATION) {
      throw new AttendanceError(
        'ALREADY_RECORDED',
        'Attendance has already been recorded for this volunteer. Use Edit to make corrections.'
      );
    }
    throw err;
  }
}

async function checkOut(eventRegistrationId, adminId) {
  await assertActiveRegistration(eventRegistrationId);

  const attendance = await attendanceModel.findByRegistrationId(eventRegistrationId);
  if (!attendance || !attendance.check_in_time) {
    throw new AttendanceError('NOT_CHECKED_IN', 'This volunteer has not been checked in yet.');
  }
  if (attendance.check_out_time) {
    throw new AttendanceError(
      'ALREADY_CHECKED_OUT',
      'This volunteer has already been checked out.'
    );
  }

  const checkOutTime = new Date();
  const hours = computeHours(attendance.check_in_time, checkOutTime);
  return attendanceModel.checkOut(attendance.id, checkOutTime, hours, adminId);
}

// Direct-mark path: hours come from the event's own scheduled start/end
// time (admin feature #5), since there's no live check-in/check-out to
// measure from.
async function markPresent(eventRegistrationId, adminId) {
  const registration = await assertActiveRegistration(eventRegistrationId);
  await assertNotAlreadyRecorded(eventRegistrationId);

  const event = await eventModel.findById(registration.event_id);
  const hours = computeHours(event.start_datetime, event.end_datetime);

  try {
    return await attendanceModel.markPresent(eventRegistrationId, hours, adminId);
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) {
      throw new AttendanceError(
        'ALREADY_RECORDED',
        'Attendance has already been recorded for this volunteer. Use Edit to make corrections.'
      );
    }
    throw err;
  }
}

async function markAbsent(eventRegistrationId, adminId) {
  await assertActiveRegistration(eventRegistrationId);
  await assertNotAlreadyRecorded(eventRegistrationId);

  try {
    return await attendanceModel.markAbsent(eventRegistrationId, adminId);
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) {
      throw new AttendanceError(
        'ALREADY_RECORDED',
        'Attendance has already been recorded for this volunteer. Use Edit to make corrections.'
      );
    }
    throw err;
  }
}

// Admin correction pathway. If both a check-in and a check-out time are
// given, hours are recomputed from them (single source of truth); if not,
// the admin's manually entered hours value is used as-is — needed for
// cases with no real timestamps to compute from.
async function editAttendance(eventRegistrationId, body, adminId) {
  const attendance = await attendanceModel.findByRegistrationId(eventRegistrationId);
  if (!attendance) {
    throw new AttendanceError('NOT_FOUND', 'Attendance record not found.');
  }

  if (!VALID_STATUSES.includes(body.status)) {
    throw new AttendanceError('INVALID_STATUS', 'Please select a valid attendance status.');
  }

  if (body.status === 'no_show') {
    return attendanceModel.update(attendance.id, {
      status: 'no_show',
      checkInTime: null,
      checkOutTime: null,
      hoursContributed: 0,
      adminId,
    });
  }

  const checkInTime = body.checkInTime ? new Date(body.checkInTime) : null;
  const checkOutTime = body.checkOutTime ? new Date(body.checkOutTime) : null;

  if (checkInTime && Number.isNaN(checkInTime.getTime())) {
    throw new AttendanceError('INVALID_DATES', 'Invalid check-in time.');
  }
  if (checkOutTime && Number.isNaN(checkOutTime.getTime())) {
    throw new AttendanceError('INVALID_DATES', 'Invalid check-out time.');
  }
  if (checkInTime && checkOutTime && checkOutTime < checkInTime) {
    throw new AttendanceError('INVALID_DATES', 'Check-out time must be after check-in time.');
  }

  let hours;
  if (checkInTime && checkOutTime) {
    hours = computeHours(checkInTime, checkOutTime);
  } else {
    hours = parseFloat(body.hoursContributed);
    if (Number.isNaN(hours) || hours < 0) {
      throw new AttendanceError(
        'INVALID_HOURS',
        'Hours contributed must be a non-negative number.'
      );
    }
  }

  return attendanceModel.update(attendance.id, {
    status: 'attended',
    checkInTime,
    checkOutTime,
    hoursContributed: hours,
    adminId,
  });
}

// Badge state: 'present' / 'absent' / 'pending' (no record yet).
function getStatusBadge(attendanceStatus) {
  if (!attendanceStatus) return 'pending';
  return attendanceStatus === 'attended' ? 'present' : 'absent';
}

module.exports = {
  AttendanceError,
  checkIn,
  checkOut,
  markPresent,
  markAbsent,
  editAttendance,
  getStatusBadge,
  computeHours,
};
