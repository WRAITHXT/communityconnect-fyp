exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('password_reset_tokens', {
    id: { type: 'serial', primaryKey: true },
    user_id: {
      type: 'integer',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    // A hash of the token is stored, never the raw token itself — the raw
    // value only ever exists in the emailed link.
    token_hash: { type: 'varchar(255)', notNull: true },
    expires_at: { type: 'timestamptz', notNull: true },
    used_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint(
    'password_reset_tokens',
    'password_reset_tokens_token_hash_unique',
    'UNIQUE(token_hash)'
  );

  pgm.createIndex('password_reset_tokens', 'user_id');
};

exports.down = (pgm) => {
  pgm.dropTable('password_reset_tokens');
};
