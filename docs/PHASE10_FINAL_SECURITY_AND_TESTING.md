# Phase 10 — Final Security, Validation, Performance Review & System Testing

Status: complete. This phase adds no new business features — it reviews and hardens every
existing module, fixes what the review found, and re-verifies the entire application end-to-end
against the live app and the live PostgreSQL database. Scope followed the brief's six parts
exactly: Security Review, Performance Review, UI Consistency, End-to-End Testing, Bug Fixing,
Documentation.

---

## 1. Security Review

### 1.1 Authentication

| Item | Finding | Action |
|---|---|---|
| JWT validation | `jwt.verify()` had no explicit `algorithms` option — relying on library defaults for algorithm selection is the classic setup for an "algorithm confusion" attack if the verification path is ever reused with a different key type. | **Fixed**: `tokenService.verifyAccessToken` now pins `{ algorithms: ['HS256'] }`; `signAccessToken` pins `{ algorithm: 'HS256' }` to match, explicitly, on both sides. |
| Cookie security | `httpOnly`, `secure` (production only), `sameSite: 'strict'`, 2h `maxAge`, `path: '/'` — already correct since Phase 2. | No change needed. |
| Session handling | Fully stateless (no server-side session store) with `token_version` as the revocation escape hatch, per the blueprint's design. Verified the suspended-account and stale-token-version paths both still correctly reject (see 1.2). | No change needed; both paths now also **logged** (see 1.10). |
| Token expiration | 2-hour expiry via `JWT_EXPIRES_IN`, enforced by `jsonwebtoken` itself (`jwt.verify` throws `TokenExpiredError` on an expired token, caught and treated as "no session" by `verifyJwt`). | Verified still correct; no change. |
| Logout behavior | `res.clearCookie` was called with only `{ path }`, not the cookie's full original options. Functionally this still clears the cookie in every mainstream browser, but doesn't match Express's own recommendation of passing the same options used when setting it. | **Fixed**: now passes the full `cookieOptions`. Logout does **not** bump `token_version` — confirmed this is the correct, deliberate design (bumping it would invalidate every other device's session too, which is "log out everywhere," a feature this app was never asked to build; see docs/PROJECT_BLUEPRINT.md §0.1). A stolen token therefore remains valid until its own 2h expiry even after the legitimate user logs out — an accepted, documented trade-off of a token_version-only revocation model with a short expiry, not a bug. |
| Startup secret validation | `JWT_SECRET` had no presence/strength check — a missing or trivially short secret would only surface as a confusing error on the *first* login attempt, not at boot. | **Fixed**: `config/env.js` now fails fast at process startup if `JWT_SECRET` (or the new `CSRF_SECRET`, below) is missing or under 32 characters, with a message telling the operator how to generate a strong one. |
| Password strength & size | Registration already required min 8 chars + upper/lower/digit. No **maximum** length existed on either the registration or login password field — an attacker-supplied multi-megabyte "password" would still reach `bcrypt.hash`/`bcrypt.compare`, which is CPU-expensive by design; this is a cheap, unauthenticated CPU-exhaustion vector. | **Fixed**: registration password now capped at 128 chars; login password capped at 128 chars too (rejected with the same generic "Invalid email or password" message as any other bad credential, so the cap itself doesn't leak information about why a login failed). |
| Rate limiting on auth | None existed. | **Fixed** — see 1.9. |

### 1.2 Authorization

- **RBAC protection**: every `/admin/*` router applies `requireRole('admin')` after `verifyJwt`; re-verified by re-grepping every route file — no admin route is missing it (see Section 4, RBAC re-check).
- **Route protection**: every route that isn't `/`, `/login`, `/register`, or `/verify-certificate` sits behind at least `verifyJwt`. The public routes are deliberately public (verified their mount order still keeps them reachable pre-authentication — the Phase 8 mount-order fix was re-tested and still holds).
- **Ownership validation**: donation/certificate detail and download routes still correctly return 404 (not 403) for another user's record (re-verified in Section 4).
- **Admin-only / user-only routes**: re-tested directly (Section 4) — a regular user hitting `/admin/events`, `/admin/donations`, `/admin/reports` all return 403 and are now logged (see 1.10).
- No changes were needed here beyond adding the logging — the RBAC design from Phase 2 onward was already sound.

### 1.3 Input Validation

Reviewed every `express-validator` chain across `src/validators/*.js`:

| Gap found | Fix |
|---|---|
| Login/registration password had no max length (see 1.1) | Added |
| `verifyCertificateValidators` (`certificateNumber`, `verificationCode`) had no max length — an arbitrarily long value would still reach a parameterized query (not an injection risk, just wasted work / oversized payload) | Added `isLength({ max: 50 })` / `isLength({ max: 20 })`, matching the certificates table's own column sizes |
| Event/donation title/description/location/amount/dates | Already had appropriate `isLength`/`isInt`/`isFloat`/`isISO8601`/`isIn` constraints since their respective phases — reconfirmed, no gaps |
| Empty values | Every required field already has `.notEmpty()` — confirmed |
| Invalid dates | `isISO8601()` used consistently everywhere a date is accepted — confirmed |
| Invalid numbers | `isInt`/`isFloat` with appropriate `min`/`gt` bounds used consistently — confirmed |

Report filters (Phase 9's `reportService.js`) are a special case: they're query-string GET
parameters, not form submissions, so they go through hand-written `parseDateParam`/`parseIdParam`/
`parseEnumParam` helpers instead of `express-validator` — re-confirmed these silently drop any
malformed value rather than passing it to a query (already tested in Phase 9; re-verified here that
this still holds after the CSRF/helmet changes, since a bad filter must never 500).

### 1.4 SQL Injection

Every model file re-audited (74 `pool.query` call sites across `src/models/`). **Zero** instances
of string-concatenated user input in SQL text. The only template-literal interpolation inside a
query string is composition of *fixed* internal fragments (e.g. `${SELECT_BASE}`, a module-level
constant; `${where}`/`${conditions.join(...)}`, built from hard-coded column-name/operator strings
with the actual values always passed as separate `$1, $2, …` parameters). This is the same
dynamic-WHERE-clause pattern used consistently since Phase 4 — confirmed safe, no changes needed.

### 1.5 XSS Protection

- Every EJS output of user-controlled data uses `<%= %>` (auto-escaping). Grepped every `<%- %>`
  (unescaped) usage in the codebase: all 21 are `include(...)` calls to trusted internal partials
  (badge components, layout `body`), plus one JSON data island
  (`reports/overview.ejs`'s `chartsJson`, which is `JSON.stringify`'d server-side with `<`
  escaped to `<` to prevent `</script>` breakout, and rendered with `type="application/json"`
  so it is inert data, never executed). **No raw user-supplied text is ever rendered unescaped.**
- No inline `<script>` blocks containing executable code exist anywhere in the view layer (only
  the inert JSON island above) — confirmed this holds after adding Chart.js, which loads via an
  external `<script src>`.
- No changes needed; this was already sound. The new strict CSP (1.7) is an additional
  defense-in-depth layer on top of correct escaping, not a replacement for it.

### 1.6 File Upload Security

Reviewed `middlewares/upload.js` (event banner uploads, the only upload path in the app):

- **File types**: whitelisted by MIME type (`image/jpeg`, `image/png`, `image/webp`) in
  `fileFilter`; a rejected file never reaches disk.
- **Maximum file size**: 2MB (`limits.fileSize`), enforced by `multer` before the handler runs.
- **Filename generation**: always server-generated (`crypto.randomUUID() + extension`) — the
  client-supplied filename is never used for the file actually written to disk.
- **Directory traversal protection**: the destination directory is a fixed, hard-coded absolute
  path (`path.join(__dirname, '../public/uploads/events')`); combined with the UUID filename, there
  is no user-controlled path segment anywhere in the write path. Uploaded files are then served via
  `express.static`, which has its own built-in traversal protection.
- No changes needed — this was already correctly built in Phase 4.

### 1.7 HTTP Security

**Before this phase**: no `helmet`, no security headers beyond Express's defaults.

**Fixed**: added `helmet` with an explicit Content-Security-Policy. Every asset this app loads is
self-hosted (Font Awesome since Phase 3, Chart.js since Phase 9, this app's own CSS/JS — no CDN
dependency anywhere) and no view has an inline `<script>` or inline `style="..."` attribute (the
two that existed, in `reports/overview.ejs`, were moved into `reports.css` classes as part of the
UI-consistency pass, Section 3), so the CSP is set to `'self'` on every directive with **no**
`'unsafe-inline'` anywhere:

```
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:;
font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self';
```

Helmet's other defaults (X-Content-Type-Options: nosniff, X-Frame-Options: SAMEORIGIN, a
conservative Referrer-Policy, Strict-Transport-Security) were left at their sensible out-of-the-box
values — verified all present on a live response (Section 4). Placed **before**
`express.static` in the middleware chain specifically so these headers apply to static assets
(CSS/JS/fonts/images) too, not only rendered pages — a static file served after `helmet` would
otherwise ship without them, since `express.static` ends the response itself for a matched file
without calling `next()`.

### 1.8 CORS

No `cors` middleware exists, and none was added. This app is a same-origin, server-rendered EJS
application — there is no separate frontend origin that needs cross-origin access to it, and no
`/api` consumer outside the browser session that's currently rendering its own pages. The secure
default for this architecture *is* the absence of a permissive `cors()` middleware: the browser's
own Same-Origin Policy already blocks any other origin from reading responses from this app. Adding
CORS headers here would only be appropriate if a separate SPA/mobile client were introduced later
consuming `/api/v1/*` cross-origin — noted for whoever picks that up, not implemented now since it
would be scope creep with nothing to actually configure against.

### 1.9 Rate Limiting

**Before this phase**: none. Login/registration had no protection against credential-stuffing or
brute-force password guessing; the public certificate-verification endpoint had no protection
against scripted abuse.

**Fixed**: added `express-rate-limit` (`middlewares/rateLimiter.js`):

- `authLimiter` — 10 requests per 15 minutes per IP, applied to `POST /login` and `POST /register`.
  Generous enough that a real person mistyping a password a few times is never blocked; tight
  enough to make scripted credential stuffing impractical. Renders a graceful page, not a raw JSON
  error, on the web routes it protects.
- `verifyLimiter` — 30 requests per 15 minutes per IP, applied to `POST /verify-certificate`. The
  public verification page has no account to lock out, but is still an unauthenticated,
  internet-facing endpoint that can be scripted; a looser limit than auth, just enough to blunt
  abuse without affecting a real visitor checking a certificate.

Both were live-tested (Section 4): 11 rapid failed logins from the same IP correctly returned
`429` starting partway through the burst, with a graceful rendered message, and the limiter is
correctly scoped per-route (it does not affect any other endpoint).

### 1.10 Logging

**Before this phase**: only Morgan→Winston HTTP request logging and the generic error handler's
error log — no security-specific events were distinguishable from routine traffic.

**Fixed** — the following are now logged via the existing Winston logger (never logging passwords
or tokens, only identifying info already visible to the actor themselves):

- `authController`: successful registration, successful login, failed login/registration attempt
  (email + failure reason code, e.g. `INVALID_CREDENTIALS`/`ACCOUNT_SUSPENDED`/`EMAIL_TAKEN`),
  logout — each with the acting user id (where applicable) and `req.ip`.
- `requireRole`: every RBAC denial (403), including the user id/role that was denied, the role(s)
  required, and the method/path attempted.
- `verifyJwt`: a rejected token from a suspended account, and a rejected stale/revoked token
  (`token_version` mismatch) — both are meaningful "someone is trying to use a credential that's no
  longer valid" signals distinct from an ordinary expired-session redirect.
- `middlewares/csrf.js`: every rejected CSRF token (missing or invalid), with method/path.
- `middlewares/rateLimiter.js`: every rate-limit trip, with method/path/IP.

All verified live in Section 4 (a full E2E run's log output was inspected directly, confirming each
event type appears exactly once per occurrence with no sensitive data included).

### 1.11 CSRF Protection (added this phase, by explicit decision)

CSRF wasn't on the Phase 10 checklist the instructions gave, but the project's own blueprint
(`docs/PROJECT_BLUEPRINT.md`, Section 9) calls it "non-optional" for a cookie-carried JWT design,
and `middlewares/csrf.js` had existed as a one-line placeholder since Phase 0 earmarked for exactly
this. Asked the user directly given the scope (every POST form needed a token field); the answer
was to implement it now as part of making the app production-ready.

- **Library**: [`csrf-csrf`](https://github.com/Psifi-Solutions/csrf-csrf) (the maintained
  replacement for the deprecated `csurf`, as the blueprint itself recommended), using the
  Double-Submit-Cookie pattern — the right choice here since this app has no server-side session
  store to bind a synchronizer token to.
- **Session binding**: the CSRF token's HMAC is scoped to the caller's raw JWT cookie value when
  one exists (`getSessionIdentifier`), so a leaked CSRF cookie is useless without the matching
  (separately-scoped, `httpOnly`) auth cookie, and logging in as a different user automatically
  invalidates any previously-issued CSRF token. Anonymous requests (the login/register forms
  themselves, before a JWT exists) share a fixed identifier — there's no per-user state to protect
  on those routes yet.
- **New env var**: `CSRF_SECRET` (added to `.env.example`, and generated a real value directly into
  the local `.env` so the app keeps working without extra setup steps).
- **Coverage**: all **27** `<form method="POST">` elements across **19** view files now carry a
  hidden `<input type="hidden" name="_csrf" value="<%= csrfToken %>">` — verified 1:1 by grep
  (27 forms, 27 tokens) and by re-running every POST-driven workflow end-to-end (Section 4).
  `res.locals.csrfToken` is populated globally (`attachCsrfToken`), so no controller needed
  per-route changes.
- **Error handling**: an invalid/missing token renders a graceful 403 page (`handleCsrfError`)
  instead of the library's raw error, and is logged (1.10).

---

## 2. Performance Review

- **N+1 queries**: none found. Every list/report view already fetches its data via a single joined
  query (established since Phase 4/5 for rosters, and deliberately re-verified for Phase 9's
  report queries, which already use `Promise.all` for independent aggregates).
- **dashboardService.js**: `getUserDashboardCards` and `getAdminStats` each ran 5 independent count
  queries **sequentially** (`await` one after another) despite none depending on the others'
  results. **Fixed**: both now use `Promise.all`, so the 5 queries run concurrently against the
  connection pool instead of round-tripping one at a time. This is the dashboard every user and
  every admin hits on effectively every login — a real, if modest, latency win with zero behavior
  change.
- **Missing index**: `event_registrations.applied_at` had no index, despite the Reports module
  (Phase 9) filtering/grouping by it in the "Event Registrations Over Time" chart and the Volunteer
  Report's date-range filter — a gap left over from Phase 1, when nothing yet queried that column
  by date. **Fixed**: new migration
  (`1751500018_add-event-registrations-applied-at-index.js`) adds it. Additive-only, per this
  project's established migration convention — no existing migration was edited.
- Everything else reviewed (existing indexes on every other FK/status/date column used in a filter,
  the `certificates_user_event_unique` composite index already covering `WHERE user_id = ?` lookups
  via its leftmost-prefix, the attendance table's `UNIQUE(event_registration_id)` index) was already
  correctly in place — no redesign needed, matching "improve only where necessary."

---

## 3. UI Consistency

Reviewed navigation, sidebar, topbar, cards, buttons, tables, forms, alerts, badges, and responsive
layout across the whole app.

- **Buttons**: consistent `btn`/`btn-primary`/`btn-secondary`/`btn-ghost`/`btn-danger` (+ `btn-sm`)
  vocabulary everywhere — no rogue button classes found.
- **Badges**: consistent `badge-success`/`badge-warning`/`badge-danger`/`badge-neutral` (status)
  and `badge-role`/`badge-soft` (chrome) vocabulary — no inconsistencies found.
- **Forms**: every `<input>`/`<select>`/`<textarea>` uses `.form-control` inside a `.form-group` —
  confirmed across all form templates.
- **Responsive layout**: the two breakpoints established in Phase 3 (`layout.css`, 1023px/640px)
  still cover every page; no page-specific layout escapes them.
- **One real inconsistency found and fixed**: `reports/overview.ejs` (Phase 9) used two inline
  `style="..."` attributes (`grid-column: 1 / -1` and `margin-top: var(--space-4)`) instead of a
  CSS class, the only inline styles anywhere in the view layer. **Fixed**: moved into two new
  classes in `reports.css` (`.chart-card-wide`, `.chart-card-table`) — this also let the CSP's
  `style-src 'self'` stay strict with no `'unsafe-inline'` exception (Section 1.7).

No redesign was performed anywhere — this section found one inconsistency and fixed exactly that.

---

## 4. End-to-End Testing

Both workflows from the brief were run against the live app and the live database, driven by
`curl` with real cookie jars and real CSRF-token extraction from each rendered page (proving the
CSRF rollout doesn't break a single real form), plus a Playwright/headless-Chromium pass for the
one page with client-side rendering (the Reports charts) to catch anything a raw HTTP check
couldn't (a CSP violation, a JS error, a blank canvas).

### User workflow — Register → Login → Browse Events → Register for Event → Attendance → Volunteer Hours → Donation → Certificate → Logout

| Step | Result |
|---|---|
| Register | `302` → dashboard; security log shows `User registered` |
| Login (fresh session) | `302` → dashboard; security log shows `Login succeeded` |
| Browse Events | `200`, event visible |
| Register for Event | `302`; registration row created |
| Attendance (marked Present by admin) | `302`; attendance row created with correct hours |
| Volunteer Hours (`/my-attendance`) | `200`, shows the event and hours |
| Donation (recorded, then admin-confirmed Completed) | `302` create, `302` admin confirm |
| Certificate (generated by admin, viewed + downloaded by the volunteer) | `200` view, `200` download, valid single-page PDF |
| Public certificate verification | `200`, "Valid Certificate" |
| Logout | `302` → `/login`; security log shows `Logout` |

### Administrator workflow — Login → Create Event → Publish Event → Manage Volunteers → Attendance → Manage Donations → Generate Certificates → Reports → Logout

| Step | Result |
|---|---|
| Login | `302` → admin dashboard |
| Create Event (draft) | `302`; event row created |
| Publish Event | `302`; status → `published` |
| Manage Volunteers (roster) | `200`, volunteer visible |
| Attendance (mark Present) | `302` |
| Manage Donations (list + confirm) | `200` list, `302` confirm |
| Generate Certificates | `302`; certificate row created |
| Reports (`/admin/reports`) | `200`, live stats visible |
| Logout | `302` → `/login` |

### RBAC re-check (post-hardening)

A regular user session was re-tested directly against `/admin/events`, `/admin/reports`, and
`/admin/donations` after all Section 1 changes: all three correctly return `403`, and each denial
appears in the security log (`RBAC denied - user=2 role=user required=admin ...`).

### CSRF/rate-limit/CSP-specific checks

- Login **without** a `_csrf` field, and with a **tampered** one: both correctly `403` with a
  graceful page (not a raw error) — this was the exact bug found and fixed below.
- Login **with** the correct token: unaffected, `302` as normal.
- 11 rapid failed logins from one IP: the rate limiter engages partway through, returns `429` with
  a graceful page, and does not affect other routes.
- `/admin/reports` (the heaviest client-rendered page: 5 Chart.js charts) loaded in a real headless
  browser with the new CSP active: **zero console/page errors**, all 5 charts rendered correctly.
- Response headers on a live request confirmed: `Content-Security-Policy`,
  `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`,
  and the CSRF cookie all present.

Database confirmed unchanged after testing — every row created during this session's testing (2
test events, registrations, attendance, donations, certificates, and one throwaway registered
account) was deleted before wrapping up, restoring the exact Phase 1 baseline (3 seeded users, 3
categories, everything else at 0).

---

## 5. Bugs Found and Fixed

1. **CSRF failure page itself 500'd** — the biggest bug this phase found. `attachCurrentUser` (which
   populates `res.locals.currentUser`, used by every page's nav partial) was registered **after**
   the CSRF middlewares in `app.js`. When a request failed CSRF validation, `doubleCsrfProtection`
   called `next(err)` immediately — skipping `attachCurrentUser` entirely — so by the time
   `handleCsrfError` tried to render the graceful 403 page, `currentUser` was undefined and the EJS
   template threw, turning a clean 403 into a raw 500. Caught by actually submitting a request
   without a CSRF token, not by reading the code. **Fixed** by moving `attachCurrentUser` (and
   `attachFlashFromQuery`) before the CSRF middlewares in the chain — it has no functional
   dependency on CSRF having run first, so reordering was safe. Re-tested: missing/tampered tokens
   now correctly render a 403 page; a valid token still logs in normally.
2. Everything else described in Section 1 (missing algorithm pinning, missing max-lengths, missing
   rate limiting, missing security logging, the one inline-style UI inconsistency, the missing
   index, the sequential dashboard queries) were gaps found by the review, not runtime bugs — each
   is listed under its own checklist item above with what was changed.
3. **Create/Edit Event failed CSRF validation unconditionally** (found during manual testing
   immediately after this phase, fixed as a direct follow-up). Root cause: the event form is the
   only one in the app using `enctype="multipart/form-data"` (for the banner upload), and
   `express.json`/`express.urlencoded` never parse that content type — only the route-specific
   `multer` middleware does, which runs *after* the global `doubleCsrfProtection` in the chain. So
   `req.body._csrf` was always empty by the time the global CSRF check ran, regardless of what the
   form actually submitted, and every multipart POST was rejected unconditionally. **Fixed** by
   configuring `skipCsrfProtection: (req) => Boolean(req.is('multipart/form-data'))` on the global
   middleware (it can never validate that content type correctly, so it defers instead of failing),
   and adding a new `verifyCsrfAfterUpload` middleware (using the library's `validateRequest`
   utility) applied in `adminEventRoutes.js` immediately after `uploadEventBanner` on both the
   create and update routes — by that point `multer` has parsed the body and `req.body._csrf` is
   populated. Re-verified: valid token → succeeds and persists; missing or tampered token → still
   correctly `403`s (proving this is a reordering fix, not a bypass); every other POST form in the
   app re-spot-checked and unaffected.

No bugs were found in any previously-completed module's actual business logic (event/registration/
attendance/donation/certificate/report flows) during this phase's re-testing — everything that
worked in Phases 4-9 still works identically after the Phase 10 hardening.

---

## 6. New Files / Dependencies This Phase

- `src/middlewares/csrf.js` (filled in a Phase 0 placeholder), `src/middlewares/rateLimiter.js`
  (new).
- `database/migrations/1751500018_add-event-registrations-applied-at-index.js` (new, additive).
- New dependencies: `helmet`, `express-rate-limit`, `csrf-csrf`.
- New env var: `CSRF_SECRET` (documented in `.env.example`).

## Not Yet Implemented / Known, Accepted Gaps

- **Notifications** — still out of scope, per every prior phase's roadmap note.
- **Logout doesn't revoke the JWT itself** (Section 1.1) — a deliberate trade-off of this app's
  `token_version`-based revocation model (bumping it on every logout would force-logout every other
  device too), mitigated by the short 2-hour token expiry.
- **CORS** — no configuration exists because none is needed for this same-origin architecture
  (Section 1.8); would need real configuration only if a cross-origin API consumer were introduced.
