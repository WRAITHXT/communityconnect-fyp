// Lightweight flash-message mechanism using the query string instead of
// server-side session storage (this app has none — auth is stateless JWT).
// A controller redirects to `${path}?flash=...&flashType=success|error`
// (see utils/viewHelpers.js's redirectWithFlash); this middleware turns
// that into res.locals.flash for the next request's render. Safe from XSS
// since the message is always rendered through EJS's auto-escaping, and
// the messages themselves are always ones the app constructs, never raw
// user input.
function attachFlashFromQuery(req, res, next) {
  if (req.query.flash) {
    res.locals.flash = {
      message: req.query.flash,
      type: req.query.flashType === 'error' ? 'error' : 'success',
    };
  }
  next();
}

module.exports = { attachFlashFromQuery };
