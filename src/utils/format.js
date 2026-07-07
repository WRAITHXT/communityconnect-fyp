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

module.exports = { getInitials };
