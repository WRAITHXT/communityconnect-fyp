exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('certificates', {
    id: { type: 'serial', primaryKey: true },
    // CASCADE: a certificate has no purpose once the user or event it
    // refers to is gone.
    user_id: {
      type: 'integer',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    event_id: {
      type: 'integer',
      notNull: true,
      references: 'events',
      onDelete: 'CASCADE',
    },
    certificate_number: { type: 'varchar(50)', notNull: true },
    issued_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    file_key: { type: 'varchar(255)' },
  });

  pgm.addConstraint('certificates', 'certificates_number_unique', 'UNIQUE(certificate_number)');
  // One certificate per user per event.
  pgm.addConstraint('certificates', 'certificates_user_event_unique', 'UNIQUE(user_id, event_id)');

  pgm.createIndex('certificates', 'event_id');
};

exports.down = (pgm) => {
  pgm.dropTable('certificates');
};
