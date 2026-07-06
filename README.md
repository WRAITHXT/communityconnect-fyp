# CommunityConnect

Cloud-Based Integrated Platform for Enhancing Community Event, Volunteer and Donation Management.

Full architecture, feature scope, roles, roadmap, and security design: [docs/PROJECT_BLUEPRINT.md](docs/PROJECT_BLUEPRINT.md).
Database schema details: [docs/PHASE1_DATABASE.md](docs/PHASE1_DATABASE.md) and [docs/ERD.md](docs/ERD.md).
Authentication details and how to test it: [docs/PHASE2_AUTHENTICATION.md](docs/PHASE2_AUTHENTICATION.md).

**Status**: Phase 2 — Authentication implemented (registration, login, logout, JWT-in-httpOnly-cookie, RBAC). Event Management, Volunteer Registration, Attendance, Donations, Certificates, Notifications, Reports, and the real User/Admin Dashboards are not implemented yet.

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
  config/        # env.js, db.js (pg Pool), jwt.js (active), constants.js*
  models/        # userModel.js (active); more models arrive with each future feature module
  services/       # authService.js (active); more services arrive with each future feature module
  controllers/
    web/           # authController.js (active) — renders EJS views
    api/            # authController.js (active, admin ping only) — returns JSON (/api/v1)
  routes/
    web/            # authRoutes.js (active)
    api/             # authRoutes.js (active)
  middlewares/     # errorHandler.js, verifyJwt.js, requireRole.js, validate.js (all active);
                     upload.js/csrf.js are still placeholders*
  validators/       # authValidators.js (active)
  views/            # EJS templates (layouts, partials, pages/auth (active), pages/<other features>)
  public/            # static assets (css, client-side js, images)
  utils/              # logger.js, tokenService.js (active); storage/mailer/pdfGenerator/csvExporter are placeholders*
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
  API.md                     # filled in as more API routes are built
```

`*` — file exists as a one-line placeholder marking where the logic belongs; implemented in the phase noted in its comment (see `docs/PROJECT_BLUEPRINT.md`, Section 7 for the phase order).

## What's Configured So Far

**Phase 0 — Scaffolding**

- Express app assembly (`src/app.js`) + entrypoint (`server.js`)
- EJS view engine, with a minimal header/footer partial pattern
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
- `/profile` and `/api/v1/admin/ping` as temporary, explicitly-labeled routes proving the
  middleware works — not the real User/Admin Dashboards
- Verified end-to-end with `curl`: registration, duplicate-email/weak-password/mismatched-password
  validation, login (including the no-enumeration generic error), logout, protected-route
  redirects, RBAC (403/401), tampered/malformed/expired JWT rejection, and live revocation via
  `token_version` and account suspension

## Explicitly Not Yet Implemented

Event Management, Volunteer Registration, Attendance Tracking, Donation Recording, Certificate
Generation, Notifications, Reports, and the real User/Admin Dashboards. These follow the phased
roadmap in `docs/PROJECT_BLUEPRINT.md`, starting with Event Management next.
