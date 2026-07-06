exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('audit_logs', {
    id: { type: 'serial', primaryKey: true },
    // SET NULL: the audit trail must outlive the actor — deleting a user
    // account must not erase the record that they performed an action.
    actor_id: {
      type: 'integer',
      references: 'users',
      onDelete: 'SET NULL',
    },
    action: { type: 'varchar(100)', notNull: true },
    entity_type: { type: 'varchar(50)', notNull: true },
    entity_id: { type: 'integer' },
    metadata: { type: 'jsonb' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('audit_logs', 'actor_id');
  pgm.createIndex('audit_logs', ['entity_type', 'entity_id']);
  pgm.createIndex('audit_logs', 'created_at');
};

exports.down = (pgm) => {
  pgm.dropTable('audit_logs');
};
