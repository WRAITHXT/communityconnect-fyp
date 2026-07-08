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

// CommunityConnect operates in a single fixed currency (Malaysian Ringgit).
// Every monetary value in the app — dashboards, donation pages, reports,
// exports — renders through this one function so the "RM 1,150.00" format
// (symbol, thousands separator, exactly 2 decimals) never drifts between
// pages. Takes a number or a numeric string (donation amounts come back
// from `pg` as strings for the `numeric` column type).
function formatCurrency(value) {
  const amount = Number(value) || 0;
  return `RM ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

module.exports = { getInitials, formatDate, formatCurrency };
