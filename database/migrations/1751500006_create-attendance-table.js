exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('attendance', {
    id: { type: 'serial', primaryKey: true },
    // CASCADE + UNIQUE below enforce the 1:1 relationship with
    // event_registrations described in docs/PROJECT_BLUEPRINT.md, Section 5.
    event_registration_id: {
      type: 'integer',
      notNull: true,
      references: 'event_registrations',
      onDelete: 'CASCADE',
    },
    status: { type: 'varchar(20)', notNull: true },
    hours_contributed: { type: 'numeric(5,2)', notNull: true, default: 0 },
    // RESTRICT: attendance is always recorded by an admin (NOT NULL) — that
    // admin account cannot be deleted while attendance records reference it.
    marked_by: {
      type: 'integer',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
    },
    marked_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint(
    'attendance',
    'attendance_event_registration_unique',
    'UNIQUE(event_registration_id)'
  );
  pgm.addConstraint(
    'attendance',
    'attendance_status_check',
    "CHECK (status IN ('attended','no_show'))"
  );
  pgm.addConstraint('attendance', 'attendance_hours_check', 'CHECK (hours_contributed >= 0)');

  pgm.createIndex('attendance', 'marked_by');
};

exports.down = (pgm) => {
  pgm.dropTable('attendance');
};
