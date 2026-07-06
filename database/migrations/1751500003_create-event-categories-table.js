exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('event_categories', {
    id: { type: 'serial', primaryKey: true },
    name: { type: 'varchar(100)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('event_categories', 'event_categories_name_unique', 'UNIQUE(name)');
};

exports.down = (pgm) => {
  pgm.dropTable('event_categories');
};
