exports.shorthands = undefined;

// Shared trigger function reused by every table that has an `updated_at`
// column, so "last modified" timestamps are maintained by the database
// itself rather than relied upon from application code.
exports.up = (pgm) => {
  pgm.createFunction(
    'set_updated_at',
    [],
    {
      returns: 'trigger',
      language: 'plpgsql',
      replace: true,
    },
    `
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    `
  );
};

exports.down = (pgm) => {
  pgm.dropFunction('set_updated_at', []);
};
