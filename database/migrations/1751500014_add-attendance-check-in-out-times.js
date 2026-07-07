exports.shorthands = undefined;

// The Phase 1 `attendance` table already had status/hours_contributed/
// marked_by/marked_at, but no way to record actual check-in/check-out
// timestamps — this phase's "Check volunteers in"/"Check volunteers out"
// features and "store check-in and check-out timestamps" system
// requirement need them. Both are nullable: a volunteer marked Present or
// Absent directly (without the live check-in/check-out flow) never gets
// real timestamps, only a computed hours_contributed value — see
// docs/PHASE6_ATTENDANCE_TRACKING.md.
exports.up = (pgm) => {
  pgm.addColumn('attendance', {
    check_in_time: { type: 'timestamptz' },
    check_out_time: { type: 'timestamptz' },
  });

  pgm.addConstraint(
    'attendance',
    'attendance_checkout_after_checkin_check',
    'CHECK (check_out_time IS NULL OR check_in_time IS NULL OR check_out_time >= check_in_time)'
  );
};

exports.down = (pgm) => {
  pgm.dropConstraint('attendance', 'attendance_checkout_after_checkin_check');
  pgm.dropColumn('attendance', ['check_in_time', 'check_out_time']);
};
