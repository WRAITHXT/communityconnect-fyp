const crypto = require('crypto');

const certificateModel = require('../models/certificateModel');
const registrationModel = require('../models/registrationModel');
const attendanceModel = require('../models/attendanceModel');
const verificationLogModel = require('../models/verificationLogModel');
const notificationService = require('./notificationService');

const UNIQUE_VIOLATION = '23505';
const MAX_CODE_ATTEMPTS = 5;
// Excludes 0/O and 1/I so a hand-typed verification code is never ambiguous.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

class CertificateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CertificateError';
    this.code = code;
  }
}

function randomCode(length) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

function generateCertificateNumber() {
  return `CC-${new Date().getFullYear()}-${randomCode(6)}`;
}

function generateVerificationCode() {
  return randomCode(10);
}

// System requirement #1: eligible only if the volunteer's registration is
// approved and their attendance was marked Present ('attended').
function assertEligible(registration, attendance) {
  if (!registration || registration.status !== 'approved') {
    throw new CertificateError(
      'NOT_ELIGIBLE',
      'Only an approved, registered volunteer is eligible for a certificate.'
    );
  }
  if (!attendance || attendance.status !== 'attended') {
    throw new CertificateError(
      'NOT_ELIGIBLE',
      'A certificate can only be generated for a volunteer marked Present.'
    );
  }
}

// System requirement #2: one certificate per volunteer per event. The
// UNIQUE(user_id, event_id) constraint is the real guarantee (race safety
// net below); this pre-check just gives a clear message in the normal case.
async function generateCertificate(registrationId, adminId) {
  const registration = await registrationModel.findById(registrationId);
  const attendance = registration
    ? await attendanceModel.findByRegistrationId(registrationId)
    : null;
  assertEligible(registration, attendance);

  const existing = await certificateModel.findByEventAndUser(
    registration.event_id,
    registration.user_id
  );
  if (existing) {
    throw new CertificateError(
      'DUPLICATE',
      'A certificate has already been issued for this volunteer and event. Use Regenerate instead.'
    );
  }

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    try {
      const certificate = await certificateModel.create({
        userId: registration.user_id,
        eventId: registration.event_id,
        certificateNumber: generateCertificateNumber(),
        verificationCode: generateVerificationCode(),
        totalHours: attendance.hours_contributed,
        generatedBy: adminId,
      });
      await notificationService.notifyCertificateGenerated(registration.user_id, certificate.id);
      return certificate;
    } catch (err) {
      if (err.code === UNIQUE_VIOLATION && err.constraint === 'certificates_user_event_unique') {
        throw new CertificateError(
          'DUPLICATE',
          'A certificate has already been issued for this volunteer and event. Use Regenerate instead.'
        );
      }
      if (
        err.code === UNIQUE_VIOLATION &&
        (err.constraint === 'certificates_number_unique' ||
          err.constraint === 'certificates_verification_code_unique')
      ) {
        // Astronomically unlikely random-code collision — retry with fresh codes.
        continue;
      }
      throw err;
    }
  }
  throw new CertificateError(
    'CODE_GENERATION_FAILED',
    'Could not generate a unique certificate. Please try again.'
  );
}

// Admin feature #2: re-issues the existing row (fresh verification code,
// issue date, and hours snapshot; reactivates it if it had been revoked)
// rather than creating a second one — eligibility is re-checked in case the
// underlying registration/attendance changed since the original issue.
async function regenerateCertificate(certificateId, adminId) {
  const certificate = await certificateModel.findById(certificateId);
  if (!certificate) {
    throw new CertificateError('NOT_FOUND', 'Certificate not found.');
  }

  const registration = await registrationModel.findByEventAndUser(
    certificate.event_id,
    certificate.user_id
  );
  const attendance = registration
    ? await attendanceModel.findByRegistrationId(registration.id)
    : null;
  assertEligible(registration, attendance);

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    try {
      return await certificateModel.reissue(certificateId, {
        verificationCode: generateVerificationCode(),
        totalHours: attendance.hours_contributed,
        generatedBy: adminId,
      });
    } catch (err) {
      if (
        err.code === UNIQUE_VIOLATION &&
        err.constraint === 'certificates_verification_code_unique'
      ) {
        continue;
      }
      throw err;
    }
  }
  throw new CertificateError(
    'CODE_GENERATION_FAILED',
    'Could not regenerate a unique verification code. Please try again.'
  );
}

async function revokeCertificate(certificateId, adminId) {
  const certificate = await certificateModel.findById(certificateId);
  if (!certificate) {
    throw new CertificateError('NOT_FOUND', 'Certificate not found.');
  }
  if (certificate.status === 'revoked') {
    throw new CertificateError('ALREADY_REVOKED', 'This certificate has already been revoked.');
  }
  return certificateModel.revoke(certificateId, adminId);
}

// Verification page: deliberately binary (Valid / Invalid). A revoked
// certificate is reported Invalid too — revocation exists specifically to
// invalidate a previously-issued certificate — and a wrong ID/code pair
// never reveals which half was wrong. Every attempt is logged (Phase 9
// Reports & Analytics' "verification statistics") — logging never changes
// the Valid/Invalid result shown to the caller.
async function verifyCertificate(certificateNumber, verificationCode) {
  const trimmedNumber = certificateNumber.trim();
  const certificate = await certificateModel.findForVerification(
    trimmedNumber,
    verificationCode.trim().toUpperCase()
  );
  const isValid = Boolean(certificate) && certificate.status === 'active';

  await verificationLogModel.create({
    certificateId: certificate ? certificate.id : null,
    // Truncated to fit certificate_number_attempted's varchar(50) — the
    // verification form has no length limit, but a value this long could
    // never match a real certificate number anyway.
    certificateNumberAttempted: trimmedNumber.slice(0, 50),
    result: isValid ? 'valid' : 'invalid',
  });

  if (!isValid) {
    return { valid: false, certificate: null };
  }
  return { valid: true, certificate };
}

module.exports = {
  CertificateError,
  generateCertificate,
  regenerateCertificate,
  revokeCertificate,
  verifyCertificate,
};
