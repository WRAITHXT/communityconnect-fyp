exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('users', {
    id: { type: 'serial', primaryKey: true },
    name: { type: 'varchar(150)', notNull: true },
    email: { type: 'varchar(255)', notNull: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    role: { type: 'varchar(20)', notNull: true, default: 'user' },
    phone: { type: 'varchar(20)' },
    profile_photo_key: { type: 'varchar(255)' },
    status: { type: 'varchar(20)', notNull: true, default: 'active' },
    // Bumped on password change / admin suspension / "log out everywhere".
    // A JWT whose embedded token_version no longer matches this value is
    // treated as revoked (see docs/PROJECT_BLUEPRINT.md, Section 9).
    token_version: { type: 'integer', notNull: true, default: 0 },
    email_verified_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('users', 'users_email_unique', 'UNIQUE(email)');
  pgm.addConstraint('users', 'users_role_check', "CHECK (role IN ('admin','user'))");
  pgm.addConstraint('users', 'users_status_check', "CHECK (status IN ('active','suspended'))");

  pgm.createIndex('users', 'role');
  pgm.createIndex('users', 'status');

  pgm.createTrigger('users', 'set_users_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    level: 'ROW',
    function: 'set_updated_at',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('users');
};
