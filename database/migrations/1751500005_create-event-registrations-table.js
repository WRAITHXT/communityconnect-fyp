exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('event_registrations', {
    id: { type: 'serial', primaryKey: true },
    // CASCADE: registrations only make sense in the context of their event.
    event_id: {
      type: 'integer',
      notNull: true,
      references: 'events',
      onDelete: 'CASCADE',
    },
    // CASCADE: a deleted user's registrations are meaningless.
    user_id: {
      type: 'integer',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    status: { type: 'varchar(20)', notNull: true, default: 'pending' },
    applied_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    // SET NULL: deleting the admin who decided this application must not
    // delete the registration itself — only the "who decided" attribution.
    decided_by: {
      type: 'integer',
      references: 'users',
      onDelete: 'SET NULL',
    },
    decided_at: { type: 'timestamptz' },
  });

  pgm.addConstraint(
    'event_registrations',
    'event_registrations_status_check',
    "CHECK (status IN ('pending','approved','rejected','withdrawn'))"
  );
  // A user may only have one registration per event.
  pgm.addConstraint(
    'event_registrations',
    'event_registrations_event_user_unique',
    'UNIQUE(event_id, user_id)'
  );

  pgm.createIndex('event_registrations', 'event_id');
  pgm.createIndex('event_registrations', 'user_id');
  pgm.createIndex('event_registrations', 'status');
};

exports.down = (pgm) => {
  pgm.dropTable('event_registrations');
};
