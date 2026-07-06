exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('notifications', {
    id: { type: 'serial', primaryKey: true },
    user_id: {
      type: 'integer',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    type: { type: 'varchar(50)', notNull: true },
    message: { type: 'text', notNull: true },
    // Deliberately not a foreign key: this is a polymorphic reference (an
    // event, registration, donation, or certificate). Enforcing it with a
    // real FK would require either one column per possible target table or
    // a shared "entities" table — both add complexity this module doesn't
    // need. Documented convention: related_entity_type names the table,
    // related_entity_id is its id. Integrity here is an application-layer
    // concern, not a database-layer one.
    related_entity_type: { type: 'varchar(50)' },
    related_entity_id: { type: 'integer' },
    is_read: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // Composite index for the most common query: "unread notifications for user X".
  pgm.createIndex('notifications', ['user_id', 'is_read']);
  pgm.createIndex('notifications', 'created_at');
};

exports.down = (pgm) => {
  pgm.dropTable('notifications');
};
