// Turns a stored file key (e.g. "uploads/events/<uuid>.jpg") into a public
// URL. Local disk today — swap this one function for an S3-compatible
// implementation later without touching any caller (see
// docs/PROJECT_BLUEPRINT.md, Section 1). Exposed to every EJS view as
// `getBannerUrl` via app.locals in src/app.js.
function getPublicUrl(key) {
  if (!key) return null;
  return `/${key}`;
}

module.exports = { getPublicUrl };
