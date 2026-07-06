exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('donations', {
    id: { type: 'serial', primaryKey: true },
    // Nullable + SET NULL: donations may be general/undesignated (no event),
    // and a donation record must survive the event it was tied to being
    // removed later — it just becomes undesignated.
    event_id: {
      type: 'integer',
      references: 'events',
      onDelete: 'SET NULL',
    },
    // Nullable + SET NULL: donor may be anonymous/walk-in (no account), and
    // deleting a user account must not delete their donation history.
    donor_id: {
      type: 'integer',
      references: 'users',
      onDelete: 'SET NULL',
    },
    // Used for walk-in/anonymous donors who have no user_id, or as a
    // display name convention — see docs/PROJECT_BLUEPRINT.md, Section 5.
    donor_name: { type: 'varchar(150)' },
    amount: { type: 'numeric(12,2)', notNull: true },
    currency: { type: 'char(3)', notNull: true, default: 'PKR' },
    payment_method: { type: 'varchar(30)', notNull: true },
    is_anonymous: { type: 'boolean', notNull: true, default: false },
    notes: { type: 'text' },
    // Null when the donor recorded their own donation rather than an admin
    // logging it on their behalf (e.g. cash collected at an event).
    recorded_by: {
      type: 'integer',
      references: 'users',
      onDelete: 'SET NULL',
    },
    donated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('donations', 'donations_amount_check', 'CHECK (amount > 0)');
  pgm.addConstraint(
    'donations',
    'donations_payment_method_check',
    "CHECK (payment_method IN ('cash','bank_transfer','other'))"
  );

  pgm.createIndex('donations', 'event_id');
  pgm.createIndex('donations', 'donor_id');
  pgm.createIndex('donations', 'donated_at');
};

exports.down = (pgm) => {
  pgm.dropTable('donations');
};
