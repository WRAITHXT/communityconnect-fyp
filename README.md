# CommunityConnect

Cloud-Based Integrated Platform for Enhancing Community Event, Volunteer and Donation Management.

Full architecture, feature scope, roles, roadmap, and security design: [docs/PROJECT_BLUEPRINT.md](docs/PROJECT_BLUEPRINT.md).
Database schema details: [docs/PHASE1_DATABASE.md](docs/PHASE1_DATABASE.md) and [docs/ERD.md](docs/ERD.md).

**Status**: Phase 1 — database schema designed, migrated, and seeded. No authentication, models, controllers, services, routes, or business features are implemented yet.

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
  config/        # env.js, db.js (pg Pool), jwt.js*, constants.js*
  models/        # data access — parameterized SQL via pg, no ORM (empty until Database Design phase)
  services/       # business logic (empty until each feature module is built)
  controllers/
    web/           # renders EJS views
    api/            # returns JSON (/api/v1)
  routes/
    web/
    api/
  middlewares/     # errorHandler.js (active); verifyJwt/requireRole/validate/upload/csrf are placeholders*
  validators/       # request validation schemas (empty until routes exist)
  views/            # EJS templates (layouts, partials, pages/<feature>)
  public/            # static assets (css, client-side js, images)
  utils/              # logger.js (active); storage/mailer/pdfGenerator/csvExporter/tokenService are placeholders*
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
  API.md                     # filled in as API routes are built
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

## Explicitly Not Yet Implemented

Authentication/JWT, models, controllers, services, routes, and all business features (events, volunteering, attendance, donations, certificates, notifications, reports). These follow the phased roadmap in `docs/PROJECT_BLUEPRINT.md`, starting with Authentication next.
