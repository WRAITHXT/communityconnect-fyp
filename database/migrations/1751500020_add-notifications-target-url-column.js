// Additive-only: a nullable destination link for a notification (e.g.
// "/events/12"). Nullable and with no default, so every notification
// created before this migration (and any created without one going
// forward) simply has target_url = NULL — the reader-side code treats
// that as "no destination" rather than an error.
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn('notifications', {
    target_url: { type: 'varchar(255)' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('notifications', 'target_url');
};
