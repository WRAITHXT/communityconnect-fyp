// The `notifications` table itself already exists (migration 1751500009,
// from the module's original design) but the module was never wired up and
// was later removed from scope — the table has been sitting empty ever
// since. This migration only adds what the (now revived, simplified)
// notification feature actually needs on top of it: a short `title`
// separate from the longer `message` body, and a CHECK constraint on
// `type` restricted to the four events that create a notification. Nothing
// about any other existing table is touched, and since the table has zero
// rows, adding `title` as NOT NULL needs no backfill/default step.
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn('notifications', {
    title: { type: 'varchar(200)', notNull: true },
  });

  pgm.addConstraint(
    'notifications',
    'notifications_type_check',
    "CHECK (type IN ('registration','attendance','certificate','donation'))"
  );
};

exports.down = (pgm) => {
  pgm.dropConstraint('notifications', 'notifications_type_check');
  pgm.dropColumn('notifications', 'title');
};
