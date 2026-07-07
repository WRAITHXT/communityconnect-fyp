// Up to 2 uppercase initials from a display name, for avatar circles.
function getInitials(name) {
  if (!name) return '';

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

// Same rendering as app.locals.formatDate (src/app.js) — factored out here
// so non-EJS code (reportService's CSV/PDF column formatters) can format a
// date identically without duplicating the Intl options.
function formatDate(value) {
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

module.exports = { getInitials, formatDate };
