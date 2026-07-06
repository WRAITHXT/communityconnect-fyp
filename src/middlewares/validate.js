const { validationResult } = require('express-validator');

// Factory: validate(viewName) returns middleware that runs after an
// express-validator chain. On failure it re-renders the originating EJS
// form with the error messages and the non-sensitive submitted values
// (never the password) so the user doesn't lose their input. On success it
// just calls next().
function validate(viewName) {
  return (req, res, next) => {
    const result = validationResult(req);
    if (result.isEmpty()) return next();

    return res.status(400).render(viewName, {
      errors: result.array().map((e) => e.msg),
      values: { name: req.body.name, email: req.body.email },
    });
  };
}

module.exports = { validate };
