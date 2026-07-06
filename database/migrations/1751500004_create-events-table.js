exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('events', {
    id: { type: 'serial', primaryKey: true },
    // RESTRICT: a category in use by at least one event cannot be deleted —
    // the category must be reassigned/removed from events first.
    category_id: {
      type: 'integer',
      notNull: true,
      references: 'event_categories',
      onDelete: 'RESTRICT',
    },
    title: { type: 'varchar(200)', notNull: true },
    description: { type: 'text' },
    location: { type: 'varchar(255)' },
    start_datetime: { type: 'timestamptz', notNull: true },
    end_datetime: { type: 'timestamptz', notNull: true },
    capacity: { type: 'integer', notNull: true },
    banner_image_key: { type: 'varchar(255)' },
    status: { type: 'varchar(20)', notNull: true, default: 'draft' },
    // RESTRICT: preserves the "who created this event" audit trail — the
    // admin account cannot be deleted while it still owns events.
    created_by: {
      type: 'integer',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint(
    'events',
    'events_status_check',
    "CHECK (status IN ('draft','published','cancelled','completed'))"
  );
  pgm.addConstraint('events', 'events_capacity_check', 'CHECK (capacity > 0)');
  pgm.addConstraint('events', 'events_dates_check', 'CHECK (end_datetime > start_datetime)');

  pgm.createIndex('events', 'category_id');
  pgm.createIndex('events', 'status');
  pgm.createIndex('events', 'start_datetime');
  pgm.createIndex('events', 'created_by');

  pgm.createTrigger('events', 'set_events_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    level: 'ROW',
    function: 'set_updated_at',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('events');
};
