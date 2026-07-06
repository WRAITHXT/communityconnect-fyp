exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('email_verification_tokens', {
    id: { type: 'serial', primaryKey: true },
    user_id: {
      type: 'integer',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    token_hash: { type: 'varchar(255)', notNull: true },
    expires_at: { type: 'timestamptz', notNull: true },
    used_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint(
    'email_verification_tokens',
    'email_verification_tokens_token_hash_unique',
    'UNIQUE(token_hash)'
  );

  pgm.createIndex('email_verification_tokens', 'user_id');
};

exports.down = (pgm) => {
  pgm.dropTable('email_verification_tokens');
};
