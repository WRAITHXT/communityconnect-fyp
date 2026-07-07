exports.shorthands = undefined;

// Reshapes the Phase 1 `donations` table — designed then for a richer,
// possibly-anonymous, possibly-event-linked, admin-recorded ledger — to
// match Phase 7's simpler, self-service, always-authenticated-donor
// design. Safe because donations has never been written to by any prior
// phase (Donation Management is the first module to use it).
//
// Dropped: event_id, currency, payment_method, is_anonymous, donor_name,
// recorded_by — none are part of this phase's explicit requirements, and
// "donor_id" alone now satisfies "record the user who submitted the
// donation" (system requirement #5), since every donation is tied to an
// authenticated user rather than an optional walk-in/anonymous donor.
//
// Renamed: notes -> description (now required — one of the four fields
// every donation must have).
//
// Added: donation_type (Monetary/Food/Clothing/Medical Supplies/Other),
// status (Completed/Pending/Cancelled), updated_at (+ the existing
// set_updated_at trigger, reused from Phase 1).
//
// Changed: amount is now nullable (only required when donation_type is
// 'monetary' — enforced by donations_amount_required_for_monetary_check);
// donor_id is now NOT NULL with ON DELETE RESTRICT (was nullable/SET
// NULL) — preserves donation history rather than orphaning it.
exports.up = (pgm) => {
  pgm.dropConstraint('donations', 'donations_payment_method_check');
  pgm.dropConstraint('donations', 'donations_event_id_fkey');
  pgm.dropConstraint('donations', 'donations_recorded_by_fkey');
  pgm.dropColumn('donations', [
    'event_id',
    'currency',
    'payment_method',
    'is_anonymous',
    'donor_name',
    'recorded_by',
  ]);

  pgm.dropConstraint('donations', 'donations_donor_id_fkey');
  pgm.alterColumn('donations', 'donor_id', { notNull: true });
  pgm.addConstraint('donations', 'donations_donor_id_fkey', {
    foreignKeys: {
      columns: 'donor_id',
      references: 'users',
      onDelete: 'RESTRICT',
    },
  });

  pgm.renameColumn('donations', 'notes', 'description');
  pgm.alterColumn('donations', 'description', { notNull: true });

  pgm.dropConstraint('donations', 'donations_amount_check');
  pgm.alterColumn('donations', 'amount', { notNull: false });
  pgm.addConstraint('donations', 'donations_amount_check', 'CHECK (amount IS NULL OR amount > 0)');

  pgm.addColumn('donations', {
    donation_type: { type: 'varchar(20)', notNull: true, default: 'monetary' },
    status: { type: 'varchar(20)', notNull: true, default: 'pending' },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint(
    'donations',
    'donations_type_check',
    "CHECK (donation_type IN ('monetary','food','clothing','medical_supplies','other'))"
  );
  pgm.addConstraint(
    'donations',
    'donations_status_check',
    "CHECK (status IN ('completed','pending','cancelled'))"
  );
  pgm.addConstraint(
    'donations',
    'donations_amount_required_for_monetary_check',
    "CHECK (donation_type != 'monetary' OR amount IS NOT NULL)"
  );

  pgm.createIndex('donations', 'donation_type');
  pgm.createIndex('donations', 'status');

  pgm.createTrigger('donations', 'set_donations_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    level: 'ROW',
    function: 'set_updated_at',
  });
};

exports.down = (pgm) => {
  pgm.dropTrigger('donations', 'set_donations_updated_at');
  pgm.dropIndex('donations', 'status');
  pgm.dropIndex('donations', 'donation_type');

  pgm.dropConstraint('donations', 'donations_amount_required_for_monetary_check');
  pgm.dropConstraint('donations', 'donations_status_check');
  pgm.dropConstraint('donations', 'donations_type_check');
  pgm.dropColumn('donations', ['donation_type', 'status', 'updated_at']);

  pgm.dropConstraint('donations', 'donations_amount_check');
  pgm.alterColumn('donations', 'amount', { notNull: true });
  pgm.addConstraint('donations', 'donations_amount_check', 'CHECK (amount > 0)');

  pgm.alterColumn('donations', 'description', { notNull: false });
  pgm.renameColumn('donations', 'description', 'notes');

  pgm.dropConstraint('donations', 'donations_donor_id_fkey');
  pgm.alterColumn('donations', 'donor_id', { notNull: false });
  pgm.addConstraint('donations', 'donations_donor_id_fkey', {
    foreignKeys: {
      columns: 'donor_id',
      references: 'users',
      onDelete: 'SET NULL',
    },
  });

  pgm.addColumn('donations', {
    event_id: { type: 'integer', references: 'events', onDelete: 'SET NULL' },
    currency: { type: 'char(3)', notNull: true, default: 'PKR' },
    payment_method: { type: 'varchar(30)', notNull: true, default: 'other' },
    is_anonymous: { type: 'boolean', notNull: true, default: false },
    donor_name: { type: 'varchar(150)' },
    recorded_by: { type: 'integer', references: 'users', onDelete: 'SET NULL' },
  });
  pgm.addConstraint(
    'donations',
    'donations_payment_method_check',
    "CHECK (payment_method IN ('cash','bank_transfer','other'))"
  );
  pgm.createIndex('donations', 'event_id');
};
