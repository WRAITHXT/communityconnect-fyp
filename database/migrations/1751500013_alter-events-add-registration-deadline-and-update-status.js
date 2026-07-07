exports.shorthands = undefined;

// Schema evolution for the Event Management phase:
//  1. Adds registration_deadline, a field the approved Phase 1 design didn't
//     anticipate but Phase 4's instructions explicitly require. Safe to add
//     as NOT NULL because the events table has never had any rows.
//  2. Narrows events.status from the original
//     draft/published/cancelled/completed (Phase 1) to draft/published/closed,
//     per Phase 4's explicit instructions. Same safety argument — the table
//     has always been empty, so redefining the constraint has no data to
//     violate. This intentionally supersedes the Phase 1 enum; see
//     docs/PHASE4_EVENT_MANAGEMENT.md for the reasoning.
exports.up = (pgm) => {
  pgm.addColumn('events', {
    registration_deadline: { type: 'timestamptz', notNull: true },
  });

  pgm.addConstraint(
    'events',
    'events_registration_deadline_check',
    'CHECK (registration_deadline <= start_datetime)'
  );

  pgm.dropConstraint('events', 'events_status_check');
  pgm.addConstraint(
    'events',
    'events_status_check',
    "CHECK (status IN ('draft','published','closed'))"
  );
};

exports.down = (pgm) => {
  pgm.dropConstraint('events', 'events_status_check');
  pgm.addConstraint(
    'events',
    'events_status_check',
    "CHECK (status IN ('draft','published','cancelled','completed'))"
  );

  pgm.dropConstraint('events', 'events_registration_deadline_check');
  pgm.dropColumn('events', 'registration_deadline');
};
