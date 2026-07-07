exports.shorthands = undefined;

// Reshapes the Phase 1 `certificates` table for this phase's actual rules.
// Like Phase 7's donations reshape, this table has never been written to by
// any prior phase (Certificate Generation is the first module to use it),
// so this is a safe, zero-data-loss change.
//
// - `file_key` is dropped: certificates are rendered to PDF on demand from
//   the row's own data (see certificatePdfService.js) rather than stored as
//   a file on disk, so there is nothing for this column to point at.
// - `verification_code`, `total_hours`, `status`, `generated_by`,
//   `revoked_by`, `revoked_at` are added to support the verification page,
//   the frozen hours-at-issuance snapshot, and the revoke/regenerate rules.
// - `certificate_number` (already NOT NULL UNIQUE from Phase 1) is kept
//   as-is and doubles as the "Certificate ID" shown to volunteers.
exports.up = (pgm) => {
  pgm.dropColumn('certificates', 'file_key');

  pgm.addColumn('certificates', {
    verification_code: { type: 'varchar(20)' },
    total_hours: { type: 'numeric(6,2)' },
    status: { type: 'varchar(20)', notNull: true, default: 'active' },
    generated_by: {
      type: 'integer',
      references: 'users',
      onDelete: 'SET NULL',
    },
    revoked_by: {
      type: 'integer',
      references: 'users',
      onDelete: 'SET NULL',
    },
    revoked_at: { type: 'timestamptz' },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // Backfill not needed (table has no rows yet), but the two new fields
  // that every certificate must have are made NOT NULL immediately so no
  // future insert can skip them.
  pgm.alterColumn('certificates', 'verification_code', { notNull: true });
  pgm.alterColumn('certificates', 'total_hours', { notNull: true });

  pgm.addConstraint(
    'certificates',
    'certificates_verification_code_unique',
    'UNIQUE(verification_code)'
  );
  pgm.addConstraint(
    'certificates',
    'certificates_status_check',
    "CHECK (status IN ('active','revoked'))"
  );

  pgm.createIndex('certificates', 'status');
  pgm.createIndex('certificates', 'issued_at');

  pgm.createTrigger('certificates', 'set_certificates_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    level: 'ROW',
    function: 'set_updated_at',
  });
};

exports.down = (pgm) => {
  pgm.dropTrigger('certificates', 'set_certificates_updated_at');
  pgm.dropIndex('certificates', 'issued_at');
  pgm.dropIndex('certificates', 'status');
  pgm.dropConstraint('certificates', 'certificates_status_check');
  pgm.dropConstraint('certificates', 'certificates_verification_code_unique');
  pgm.dropColumn('certificates', [
    'updated_at',
    'revoked_at',
    'revoked_by',
    'generated_by',
    'status',
    'total_hours',
    'verification_code',
  ]);
  pgm.addColumn('certificates', {
    file_key: { type: 'varchar(255)' },
  });
};
