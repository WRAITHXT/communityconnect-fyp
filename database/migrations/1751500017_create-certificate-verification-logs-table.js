exports.shorthands = undefined;

// New table (not a reshape of an existing one) backing the Certificate
// Report's "verification statistics" requirement. The public verification
// page (Phase 8) checks a certificate ID + code and shows Valid/Invalid, but
// records nothing — this table gives Reports something to aggregate
// (total checks, valid vs invalid) without changing the verification page's
// own behavior at all.
exports.up = (pgm) => {
  pgm.createTable('certificate_verification_logs', {
    id: { type: 'serial', primaryKey: true },
    // Nullable + SET NULL: a lookup for a certificate number that doesn't
    // exist has no certificate row to reference, and a later certificate
    // deletion (there is none today, but the FK should still degrade
    // gracefully) shouldn't erase the historical log entry.
    certificate_id: {
      type: 'integer',
      references: 'certificates',
      onDelete: 'SET NULL',
    },
    // Kept even when certificate_id is null, so an audit trail of exactly
    // what was typed survives a not-found lookup.
    certificate_number_attempted: { type: 'varchar(50)', notNull: true },
    result: { type: 'varchar(10)', notNull: true },
    checked_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint(
    'certificate_verification_logs',
    'certificate_verification_logs_result_check',
    "CHECK (result IN ('valid','invalid'))"
  );

  pgm.createIndex('certificate_verification_logs', 'certificate_id');
  pgm.createIndex('certificate_verification_logs', 'checked_at');
};

exports.down = (pgm) => {
  pgm.dropTable('certificate_verification_logs');
};
