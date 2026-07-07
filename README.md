# CommunityConnect

Cloud-Based Integrated Platform for Enhancing Community Event, Volunteer and Donation Management.

Full architecture, feature scope, roles, roadmap, and security design: [docs/PROJECT_BLUEPRINT.md](docs/PROJECT_BLUEPRINT.md).
Database schema details: [docs/PHASE1_DATABASE.md](docs/PHASE1_DATABASE.md) and [docs/ERD.md](docs/ERD.md).
Authentication details and how to test it: [docs/PHASE2_AUTHENTICATION.md](docs/PHASE2_AUTHENTICATION.md).
Dashboard module details and how to test it: [docs/PHASE3_DASHBOARD.md](docs/PHASE3_DASHBOARD.md).

**Status**: Phase 3 — User Dashboard and Admin Dashboard implemented on top of Authentication/RBAC. Event Management, Volunteer Registration, Attendance, Donations, Certificates, Notifications, and Reports are not implemented yet (their dashboard cards/stats are placeholders).

## Stack

HTML5, CSS3, JavaScript, Node.js, Express.js, PostgreSQL (`pg`, no ORM), EJS, MVC architecture, JWT authentication.

## Getting Started

```bash
npm install
cp .env.example .env   # then edit values as needed
npm run dev
```

Visit `http://localhost:3000` — you should see "CommunityConnect server is running".

The server itself still starts without PostgreSQL (the app doesn't query the database yet), but
the commands below now need a real PostgreSQL database — create one and point `DATABASE_URL` in
`.env` at it before running migrations/seed.

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

See [docs/PHASE1_DATABASE.md](docs/PHASE1_DATABASE.md) for full details on the schema and these
commands.

## Project Structure

```
src/
  config/        # env.js, db.js (pg Pool), jwt.js (active), navigation.js (sidebar nav data), constants.js*
  models/        # userModel.js (active, incl. countUsers()); more models arrive with each future module
  services/       # authService.js, dashboardService.js (active); more arrive with each future module
  controllers/
    web/           # authController.js, dashboardController.js (active) — render EJS views
    api/            # empty — no active API routes right now*
  routes/
    web/            # authRoutes.js, dashboardRoutes.js (active)
    api/             # empty*
  middlewares/     # errorHandler.js, verifyJwt.js, requireRole.js, validate.js (all active);
                     upload.js/csrf.js are still placeholders*
  validators/       # authValidators.js (active)
  views/
    layouts/         # app.ejs (sidebar+topbar shell), simple.ejs (public pages) — express-ejs-layouts
    partials/         # sidebar.ejs, topbar.ejs, breadcrumb.ejs, simpleNav.ejs, footer.ejs,
                        dashboard/statCard.ejs, dashboard/placeholderCard.ejs
    pages/             # auth/ (active), dashboard/ (active), admin/ (active), pages/<other features>
  public/
    css/               # base.css, layout.css, components.css, dashboard.css, auth.css — the design system
    js/                 # main.js (sidebar collapse, mobile drawer, user menu, greeting)
    vendor/fontawesome/  # self-hosted Font Awesome (CSS + one woff2), no CDN dependency
  utils/              # logger.js, tokenService.js, format.js (active); storage/mailer/pdfGenerator/csvExporter are placeholders*
  jobs/                # scheduled tasks (node-cron) — added when needed
database/
  migrations/           # node-pg-migrate migrations — 11 tables + updated_at trigger function
  seeders/               # 001-initial-seed.js (1 admin, 2 users, 3 categories)
tests/
  unit/ integration/ e2e/
docs/
  PROJECT_BLUEPRINT.md    # architecture, features, roles, roadmap, security
  PHASE1_DATABASE.md       # table/relationship/constraint explanations, run & seed instructions
  ERD.md                    # entity-relationship diagram (Mermaid)
  PHASE2_AUTHENTICATION.md  # what was built, how JWT/RBAC work, full test instructions
  PHASE3_DASHBOARD.md        # design system + dashboard module, design notes, full test instructions
  API.md                     # filled in as API routes are (re-)added
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

## Explicitly Not Yet Implemented

Event Management, Volunteer Registration, Attendance Tracking, Donation Recording, Certificate
Generation, Notifications, Reports. These follow the phased roadmap in
`docs/PROJECT_BLUEPRINT.md`, starting with Event Management next.
