exports.shorthands = undefined;

// Phase 10 performance review: the Reports module (Phase 9) added several
// queries that filter/group event_registrations by applied_at (the
// "Event Registrations Over Time" chart, the Volunteer Report's date-range
// filter) — a column that had no index since Phase 1, when nothing yet
// queried it by date range.
exports.up = (pgm) => {
  pgm.createIndex('event_registrations', 'applied_at');
};

exports.down = (pgm) => {
  pgm.dropIndex('event_registrations', 'applied_at');
};
