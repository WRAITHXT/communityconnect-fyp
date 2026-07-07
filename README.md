# CommunityConnect

Cloud-Based Integrated Platform for Enhancing Community Event, Volunteer and Donation Management.

Full architecture, feature scope, roles, roadmap, and security design: [docs/PROJECT_BLUEPRINT.md](docs/PROJECT_BLUEPRINT.md).
Database schema details: [docs/PHASE1_DATABASE.md](docs/PHASE1_DATABASE.md) and [docs/ERD.md](docs/ERD.md).
Authentication details and how to test it: [docs/PHASE2_AUTHENTICATION.md](docs/PHASE2_AUTHENTICATION.md).
Dashboard module details and how to test it: [docs/PHASE3_DASHBOARD.md](docs/PHASE3_DASHBOARD.md).
Event Management details and how to test it: [docs/PHASE4_EVENT_MANAGEMENT.md](docs/PHASE4_EVENT_MANAGEMENT.md).
Volunteer Registration details and how to test it: [docs/PHASE5_VOLUNTEER_REGISTRATION.md](docs/PHASE5_VOLUNTEER_REGISTRATION.md).
Attendance Tracking details and how to test it: [docs/PHASE6_ATTENDANCE_TRACKING.md](docs/PHASE6_ATTENDANCE_TRACKING.md).
Donation Management details and how to test it: [docs/PHASE7_DONATION_MANAGEMENT.md](docs/PHASE7_DONATION_MANAGEMENT.md).
Certificate Generation details and how to test it: [docs/PHASE8_CERTIFICATE_GENERATION.md](docs/PHASE8_CERTIFICATE_GENERATION.md).

**Status**: Phase 8 — Certificate Generation implemented (eligible-volunteer generation, regenerate, revoke, PDF download, public verification page, admin search/filter, colored status badges). Notifications and Reports are not implemented yet (their dashboard/sidebar entries remain placeholders).

## Stack

HTML5, CSS3, JavaScript, Node.js, Express.js, PostgreSQL (`pg`, no ORM), EJS, MVC architecture, JWT authentication.

## Getting Started

```bash
npm install
cp .env.example .env   # then edit values as needed
npm run dev
```

Visit `http://localhost:3000` — you should see "CommunityConnect server is running".

The server itself still starts without PostgreSQL, but most routes now query the database — create
one and point `DATABASE_URL` in `.env` at it, then run migrations/seed, before using the app.

## Scripts

| Script                             | Purpose                                                        |
| ---------------------------------- | -------------------------------------------------------------- |
| `npm start`                        | Start the server (production-style, no auto-restart)           |
| `npm run dev`                      | Start the server with `nodemon` (auto-restart on file changes) |
| `npm run lint`                     | Run ESLint                                                     |
| `npm run lint:fix`                 | Run ESLint and auto-fix what it can                            |
| `npm run format`                   | Run Prettier and rewrite files in place                        |
| `npm run migrate:up`               | Apply all pending database migrations                          |
| `npm run migrate:down`             | Roll back the most recent migration                            |
| `npm run migrate:create -- <name>` | Scaffold a new empty migration file                            |
| `npm run seed`                     | Insert the Phase 1 seed data (1 admin, 2 users, 3 categories)  |

`pdfkit` renders certificate PDFs directly to the HTTP response — no native/binary dependency, no
files written to disk.

See [docs/PHASE1_DATABASE.md](docs/PHASE1_DATABASE.md) for full details on the schema and these
commands.

## Project Structure

```
src/
  config/        # env.js, db.js (pg Pool), jwt.js, navigation.js (sidebar nav data, active), constants.js*
  models/        # userModel.js, eventModel.js, eventCategoryModel.js, registrationModel.js, attendanceModel.js,
                   donationModel.js, certificateModel.js (active)
  services/       # authService.js, dashboardService.js, eventService.js, registrationService.js,
                    attendanceService.js, donationService.js, certificateService.js (active)
  controllers/
    web/           # auth/dashboard/event/adminEvent/registration/adminRegistration/attendance/adminAttendance/
                     donation/adminDonation/certificate/adminCertificate/certificateVerify controllers
    api/            # empty — no active API routes right now*
  routes/
    web/            # authRoutes.js, dashboardRoutes.js, eventRoutes.js, adminEventRoutes.js, registrationRoutes.js,
                      attendanceRoutes.js, donationRoutes.js, adminDonationRoutes.js, certificateRoutes.js,
                      adminCertificateRoutes.js, certificateVerifyRoutes.js
    api/             # empty*
  middlewares/     # errorHandler.js, verifyJwt.js, requireRole.js, validate.js, upload.js, flash.js (all active);
                     csrf.js is still a placeholder*
  validators/       # authValidators.js, eventValidators.js, donationValidators.js, certificateValidators.js (active)
  views/
    layouts/         # app.ejs (sidebar+topbar shell), simple.ejs (public pages) — express-ejs-layouts
    partials/         # sidebar.ejs, topbar.ejs, breadcrumb.ejs, simpleNav.ejs, footer.ejs, flashMessage.ejs,
                        registrationStatusBadge.ejs, attendanceStatusBadge.ejs, donationStatusBadge.ejs,
                        certificateStatusBadge.ejs, dashboard/statCard.ejs, dashboard/placeholderCard.ejs
    pages/             # auth/, dashboard/, admin/ (incl. admin/events/, admin/donations/, admin/certificates/), events/,
                         registrations/, attendance/, donations/, certificates/, verifyCertificate.ejs (active)
  public/
    css/               # base.css, layout.css, components.css, dashboard.css, auth.css, events.css — the design system
    js/                 # main.js (sidebar collapse, mobile drawer, user menu, greeting, delete-confirm, donation type toggle)
    vendor/fontawesome/  # self-hosted Font Awesome (CSS + one woff2), no CDN dependency
    uploads/events/       # event banner images (gitignored, created at runtime by middlewares/upload.js)
  utils/              # logger.js, tokenService.js, format.js, storage.js, viewHelpers.js, pdfGenerator.js (active); mailer/csvExporter are placeholders*
  jobs/                # scheduled tasks (node-cron) — added when needed
database/
  migrations/           # node-pg-migrate migrations — 11 tables + updated_at trigger + registration_deadline/status
                          update + attendance check-in/check-out columns + donations reshape + certificates reshape
  seeders/               # 001-initial-seed.js (1 admin, 2 users, 3 categories)
tests/
  unit/ integration/ e2e/
docs/
  PROJECT_BLUEPRINT.md    # architecture, features, roles, roadmap, security
  PHASE1_DATABASE.md       # table/relationship/constraint explanations, run & seed instructions
  ERD.md                    # entity-relationship diagram (Mermaid)
  PHASE2_AUTHENTICATION.md  # what was built, how JWT/RBAC work, full test instructions
  PHASE3_DASHBOARD.md        # design system + dashboard module, design notes, full test instructions
  PHASE4_EVENT_MANAGEMENT.md  # schema change, what was built, design notes, full test instructions
  PHASE5_VOLUNTEER_REGISTRATION.md  # what was built, design notes, bugs found & fixed, full test instructions
  PHASE6_ATTENDANCE_TRACKING.md       # schema change, what was built, design notes, full test instructions
  PHASE7_DONATION_MANAGEMENT.md         # schema change, what was built, design notes, full test instructions
  PHASE8_CERTIFICATE_GENERATION.md        # schema change, what was built, design notes, full test instructions
  API.md                                    # filled in as API routes are (re-)added
```

`*` — file exists as a one-line placeholder marking where the logic belongs; implemented in the phase noted in its comment (see `docs/PROJECT_BLUEPRINT.md`, Section 7 for the phase order).

## What's Configured So Far

**Phase 0 — Scaffolding**

- Express app assembly (`src/app.js`) + entrypoint (`server.js`)
- EJS view engine
- Environment variable loading via `dotenv` (`src/config/env.js`)
- PostgreSQL connection pool via `pg` (`src/config/db.js`)
- Structured logging: Winston (`src/utils/logger.js`) with HTTP request logs piped in from Morgan
- Centralized error handling (404 + generic error handler, JSON for `/api`, EJS for web routes)
- ESLint + Prettier, wired to project scripts

**Phase 1 — Database Design**

- 11 tables + 1 shared trigger function, via 12 `node-pg-migrate` migrations (`database/migrations/`)
- Primary/foreign keys, unique constraints, check constraints, indexes, defaults, and per-relationship cascade rules — see `docs/PHASE1_DATABASE.md`
- Seed script for the Phase 1 baseline data (`database/seeders/001-initial-seed.js`)
- Verified end-to-end against a live local PostgreSQL 18 database, including a rollback/re-apply test

**Phase 2 — Authentication**

- Registration, login, logout; passwords hashed with bcrypt
- JWT access tokens (2h expiry) in an `httpOnly`/`sameSite=strict` cookie; revocable via a
  `token_version` check against the live database (see `docs/PHASE2_AUTHENTICATION.md`)
- `verifyJwt` (strict) and `attachCurrentUser` (soft, sitewide) middleware; `requireRole` for RBAC
- Input validation (`express-validator`) with forms that redisplay errors without losing input
- `/profile` and `/api/v1/admin/ping` existed as temporary, explicitly-labeled routes proving the
  middleware works — both retired in Phase 3 in favor of the real dashboards
- Verified end-to-end with `curl`: registration, duplicate-email/weak-password/mismatched-password
  validation, login (including the no-enumeration generic error), logout, protected-route
  redirects, RBAC (403/401), tampered/malformed/expired JWT rejection, and live revocation via
  `token_version` and account suspension

**Phase 3 — Design System + Dashboard Module**

- Reusable design system: design tokens (`base.css`), an app shell with a collapsible sidebar +
  topbar + breadcrumb + user menu (`layout.css`), and a component library — buttons, cards,
  badges, forms, alerts, tables (`components.css`) — meant to carry through every future module
- Self-hosted Font Awesome icons (no CDN dependency — works offline for a defense demo)
- User Dashboard (`/dashboard`): welcome message, profile summary, six placeholder cards (Upcoming
  Events, My Event Registrations, My Volunteer Hours, My Donations, My Certificates, Notifications)
- Admin Dashboard (`/admin/dashboard`, `requireRole('admin')`): welcome message, five stat cards
  (Total Users is a live count; the other four are labeled placeholders), five disabled quick-action
  buttons
- Sidebar previews every future module's nav entry as a disabled "Soon" item, consistent with the
  dashboard cards' own placeholder convention
- Vanilla JS: sidebar collapse (persisted), mobile off-canvas drawer, user-menu dropdown, and a
  client-side time-of-day greeting
- Verified end-to-end: both dashboards render correctly per role, `/admin/dashboard` returns 403
  for a non-admin, `/dashboard` role-redirects admins, unauthenticated access redirects to
  `/login`, logout properly de-authenticates (tested with a real cookie jar) — see
  `docs/PHASE3_DASHBOARD.md`

**Phase 4 — Event Management**

- Schema evolution (new migration, not an edit to the Phase 1 one): `registration_deadline` column
  added; `status` narrowed to `draft`/`published`/`closed` per this phase's explicit instructions
- Admin: full CRUD, publish/unpublish, banner image upload (`multer`, self-hosted, 2MB/JPEG-PNG-WEBP
  whitelist, server-generated filenames), search + category + status filters on the management table
- Users: read-only browse (card grid) with search/category/date/status filters, event detail page,
  live remaining-volunteer-slots — all gated to `published`/`closed` events only, enforced at the
  database query level so a manipulated filter can never leak draft events
- Sidebar's "Upcoming Events"/"Manage Events" links are now real; User Dashboard's "Upcoming
  Events" card and Admin Dashboard's "Total Events" stat and "Create Event" quick action are now
  live, the same way "Total Users" became live once Authentication existed
- Verified end-to-end: RBAC (403 for non-admins on every admin route), full CRUD including banner
  upload/replacement/cleanup-on-delete, draft-vs-published visibility rules, all filters, and
  input validation (missing fields, bad date ordering, invalid category, bad/oversized banner
  files) — a real bug (validation re-renders returning `200` instead of `400`) was found and fixed
  during this session — see `docs/PHASE4_EVENT_MANAGEMENT.md`

**Phase 5 — Volunteer Registration**

- Direct self-service registration (no approve/reject step — see design notes in
  `docs/PHASE5_VOLUNTEER_REGISTRATION.md`): register, cancel (only before the registration
  deadline), view "My Registered Events"
- System-enforced rules: no duplicate registrations, no registering after the deadline, no
  registering once capacity is reached, remaining slots recalculated immediately on
  registration/cancellation
- Admin: per-event volunteer roster (`/admin/events/:id/volunteers`), search by name/email,
  remove a registration, per-event stats (registered/remaining/capacity/cancelled)
- Four-state colored status badge reusing the existing badge component
  (`badge-success`/`badge-neutral`/`badge-danger`/`badge-warning`): Registered (green),
  Registration Cancelled (gray), Registration Closed (red), Event Full (orange)
- New reusable pieces: a query-string-based flash message system (`middlewares/flash.js` +
  `viewHelpers.redirectWithFlash`) for simple "action done" redirects, and
  `viewHelpers.parsePositiveIntParam` for safely validating route-param ids
- **Two real bugs found and fixed during testing**: (1) `adminEventRoutes` applied its
  `requireRole('admin')` check to every request reaching that router regardless of path, silently
  403-ing unrelated routes mounted after it — fixed by mounting it at `/admin/events` with
  relative internal paths instead of at the app root; (2) a wrong relative `include()` path in
  `admin/events/volunteers.ejs`. Full details in `docs/PHASE5_VOLUNTEER_REGISTRATION.md`
- Verified end-to-end: successful registration, duplicate rejection, deadline enforcement,
  capacity enforcement, cancellation (including the deadline cutoff), remaining-slot
  recalculation, admin roster/search/remove, RBAC, and all four badge states

**Phase 6 — Attendance Tracking**

- Schema addition (new migration, not an edit to prior ones): `check_in_time`/`check_out_time`
  columns on `attendance`, plus a check-out-after-check-in constraint
- Admin: check volunteers in/out, mark Present/Absent directly, edit/correct any recorded
  attendance, per-event statistics (Present/Absent/Pending/Total Hours)
- Automatic hour calculation via two paths: real elapsed time on check-out, or the event's own
  scheduled duration when marked Present directly (no live check-in/out)
- System-enforced rules: only registered volunteers can have attendance recorded, one attendance
  record per volunteer per event (DB-level `UNIQUE` constraint + service-level pre-checks)
- Volunteer: attendance status shown on "My Registered Events" (integration touch), plus a new
  "My Volunteer Hours" page (total hours + full history)
- Three-state colored badge reusing existing badge components: Present (green), Absent (red),
  Pending (orange)
- Verified end-to-end: check-in, check-out with correct hour calculation, duplicate prevention,
  the direct-mark-present event-duration calculation, admin corrections (including verifying a
  manual hours override is correctly ignored when both timestamps are supplied), statistics, RBAC,
  and graceful handling of invalid/non-existent ids — see `docs/PHASE6_ATTENDANCE_TRACKING.md`

**Phase 7 — Donation Management**

- Schema reshape (new migration, not an edit to prior ones): `donations` gained `donation_type`
  (Monetary/Food/Clothing/Medical Supplies/Other), `status` (Completed/Pending/Cancelled),
  `description` (renamed from `notes`, now required); `amount` became nullable (required only for
  Monetary); `donor_id` became required with `ON DELETE RESTRICT`; `event_id`/`currency`/
  `payment_method`/`is_anonymous`/`donor_name`/`recorded_by` were dropped — none are part of this
  phase's scope
- Donor: record a donation (always starts Pending), view personal history/details/total donated,
  filter by date and type — no self-edit or self-delete (admin-only, per the instructions)
- Admin: view all, search by donor name/email, filter by type/date/status, edit (including
  confirming Pending → Completed, or → Cancelled), delete, statistics, summary by donation type
- System-enforced rules: amount required only for Monetary donations (enforced at both the service
  and database layer), ownership-protected donation detail view (404, not leaked, for another
  donor's donation)
- Three-state colored badge reusing existing badge components: Completed (green), Pending
  (orange), Cancelled (red)
- Verified end-to-end: create (all types), full validation coverage, history/filters, ownership
  protection, admin search/filter/edit/delete, statistics and summary-by-type, dashboard updates,
  RBAC, and graceful error handling — see `docs/PHASE7_DONATION_MANAGEMENT.md`

**Phase 8 — Certificate Generation**

- Schema reshape (new migration, not an edit to prior ones): `certificates` dropped `file_key`
  (PDFs are rendered on demand, never stored) and gained `verification_code` (unique), `total_hours`
  (a frozen snapshot at issuance), `status` (Active/Revoked), `generated_by`/`revoked_by`/
  `revoked_at` for an audit trail; `certificate_number` and the `UNIQUE(user_id, event_id)`
  constraint from Phase 1 are unchanged and now double as the Certificate ID and the
  duplicate-prevention guarantee
- Volunteer: view all earned certificates and their details, download a certificate as a PDF
- Admin: generate certificates from a per-event eligible-volunteer roster
  (`/admin/events/:id/certificates` — approved registration + attendance marked Present only),
  regenerate (re-issues the same certificate with a fresh verification code, also reactivating a
  revoked one), revoke, view all with search (volunteer name/event/certificate ID) and filter
  (event/issue date)
- Public certificate verification page (`/verify-certificate`, no account needed) — enter a
  Certificate ID + Verification Code, get back a binary Valid/Invalid result; a revoked certificate
  is always reported Invalid
- PDF certificates rendered on demand with `pdfkit` (`src/utils/pdfGenerator.js`) — no file ever
  stored on disk, so a certificate is always available for download from its own database row
- A routing subtlety was caught during this phase (not left as a latent bug): since every other
  `/`-mounted router applies a blanket `verifyJwt`, the public verification route had to be
  registered in `app.js` _before_ those routers, the same way `/login`/`/register` are — otherwise
  an unauthenticated visitor would be redirected to `/login` before ever reaching it. See
  `docs/PHASE8_CERTIFICATE_GENERATION.md`, Section 3
- Verified end-to-end: eligibility enforcement, duplicate prevention, generate/regenerate/revoke
  (including reactivating a revoked certificate via regenerate), PDF download (both the
  ownership-checked volunteer route and the admin route), the public verification page (valid,
  wrong code, stale code after regenerate, revoked, non-existent, case-insensitivity, empty-field
  validation), admin search/filter, dashboard updates, RBAC, and graceful error handling

## Explicitly Not Yet Implemented

Notifications, Reports. These follow the phased roadmap in `docs/PROJECT_BLUEPRINT.md`.
