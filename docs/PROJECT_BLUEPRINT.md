# Project Blueprint
## Cloud-Based Integrated Platform for Enhancing Community Event, Volunteer and Donation Management

Status: **FINAL — approved. No application code has been written. Awaiting go-ahead to begin implementation.**

Stack: HTML5, CSS3, JavaScript, Node.js, Express.js, PostgreSQL (via `pg`, no ORM), MVC, JWT authentication.

Changelog from v1: JWT auth replaces sessions; raw `pg` + parameterized SQL replaces any ORM/query-builder; Organization / OrganizationMember / Organization-verification / Transaction removed; scope trimmed to the 10 modules listed in Section 3; donations are recording-only (no payment gateway).

---

## 0. Architectural Decision (carried over from v1, confirmed)

Server-rendered MVC using **EJS** as the View layer, progressively enhanced with vanilla JS (`fetch`) for dynamic pieces — backed by an internal versioned REST API (`/api/v1/...`) that the client-side JS calls. This is unchanged from v1.

---

## 0.1 New Design Notes (decisions made while applying your changes — flag anything you want overridden)

**JWT transport: httpOnly cookie, not `localStorage`/`Authorization` header.**
Because this app renders full HTML pages via EJS (not a pure SPA/API client), the JWT is issued at login and stored in an `httpOnly`, `secure`, `sameSite=strict` cookie. The browser sends it automatically on every request — page navigations *and* `fetch()` calls — so one middleware verifies it everywhere, and there's no separate "attach Bearer header manually" plumbing needed in client JS. Trade-off: cookie-based JWTs are still CSRF-exposed (unlike header-based JWTs), so CSRF protection is retained in Section 9. `localStorage`-based JWTs would remove the CSRF concern but reintroduce the "how does a plain page GET authenticate" problem and add real XSS-token-theft risk — worse fit here.

**Stateless verification + a cheap revocation escape hatch.**
Pure JWT can't be "logged out" server-side once issued. To still support admin-suspends-user and force-logout-everywhere without a full session/blocklist table, each `User` row gets a `token_version` integer. The JWT payload includes the `token_version` at issuance; auth middleware compares it to the current DB value on each request. Bumping `token_version` (on suspend, password change, or explicit "log out of all devices") instantly invalidates every previously issued token for that user, with no extra table.

**Access token only, short-lived, re-login on expiry.**
You asked for "JWT authentication using access tokens" specifically (not refresh tokens). Recommendation: a single access token with a modest expiry (e.g., 2 hours), re-issued on login. No refresh-token rotation flow — keeps the auth module small, appropriate for FYP scope. If this proves annoying in practice, refresh tokens can be added later without changing the rest of the architecture.

**Migrations without an ORM or query builder.**
You excluded Sequelize *and* Knex. Raw `pg` has no migration tooling of its own, so plain hand-written SQL needs a runner. Recommendation: **`node-pg-migrate`** — it is a migration/versioning tool that executes your own SQL (or thin JS wrapping SQL) against `pg`; it does not introduce a query-builder or ORM abstraction for application runtime queries, which stay hand-written parameterized SQL. If you'd rather have zero extra dependencies, the alternative is a folder of numbered `.sql` files plus a ~30-line custom Node script that tracks which have run in a `schema_migrations` table — happy to go that route instead if you prefer.

**Two roles, not five.**
Removing Organization/OrganizationMember collapses the role model. With "Admin Dashboard" and "User Dashboard" as the only two dashboards requested, the platform now has exactly two roles: **admin** and **user**. A "user" can volunteer for events, donate, and receive certificates — there's no separate Volunteer/Donor split, since nothing in your module list requires one. Admins manage events, approve registrations, mark attendance, record donations, generate certificates, and view reports.

**No campaign entity.**
The old `DonationCampaign` existed to group donations under an Organization. With Organizations gone and "Donation Recording and Tracking" specified as a single feature (not "Campaigns"), donations now attach directly to an `Event` (nullable — general/undesignated donations are allowed) and "tracking" is served by the Reports module (aggregate sums by event, date range, donor) rather than a dedicated goal-tracking entity. Simpler, matches the requested scope.

**Feedback/Ratings dropped.**
Not in your module list — removed from scope entirely (was in v1). Easy to reintroduce later as its own module if wanted.

---

## 1. Overall System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER (Browser)                                 │
│  - Server-rendered EJS pages (HTML5/CSS3)                      │
│  - Vanilla JS: fetch() calls to internal REST API,             │
│    dashboard widgets, dynamic filtering, form handling         │
│  - JWT carried automatically via httpOnly cookie                │
└───────────────────────────┬────────────────────────────────────┘
                            │ HTTPS
┌───────────────────────────▼────────────────────────────────────┐
│  APPLICATION LAYER (Node.js + Express.js) — MVC                 │
│  Routes → Middleware (JWT verify / RBAC / validation)            │
│  → Controllers → Services (business logic) → Models              │
│  (Models = plain modules wrapping parameterized `pg` queries —    │
│   no ORM, no query builder)                                       │
│  Cross-cutting: logging, error handling, file storage              │
│  abstraction, mailer abstraction, job scheduler, PDF generation      │
└───────────────────────────┬────────────────────────────────────┘
                            │ Parameterized SQL (node-postgres / `pg`)
┌───────────────────────────▼────────────────────────────────────┐
│  DATA LAYER                                                      │
│  - PostgreSQL (single datastore — no session table needed;        │
│    JWT is stateless)                                               │
│  - Local disk storage for uploads in dev, behind a storage         │
│    interface so it can swap to S3-compatible storage later         │
└──────────────────────────────────────────────────────────────────┘
```

Cloud-agnostic principles (unchanged from v1):
- No AWS-SDK or Render-specific calls in core logic; storage/email/secrets sit behind small adapters.
- All configuration via environment variables (12-factor).
- App process is fully stateless now — JWT removed even the one piece of server-side state (sessions) v1 had — so it can run on any number of ephemeral instances / behind any load balancer without code changes.
- Uploaded files referenced by a logical storage key in the DB, not an absolute path.

---

## 2. MVC Architecture Design

```
Request
  → Router
  → Middleware       (verifyJWT — reads cookie, checks signature + token_version;
                       requireRole('admin') — RBAC; validate — request schema check)
  → Controller        (parses request, calls service, shapes response — no SQL, no business rules)
  → Service            (business rules: "can this user register for this event given capacity?",
                        "has this event already ended, so mark it completed before generating certs?")
  → Model               (parameterized SQL via `pg` — no ORM. One module per entity, exporting
                          functions like `findById`, `create`, `updateStatus`, each a plain
                          `pool.query('...$1...', [params])` call)
  → PostgreSQL
  ← Response: EJS render (web routes) or JSON (api routes)
```

Why a Service layer even without an ORM: it's what keeps SQL out of controllers and keeps multi-step business rules (e.g., "approving a registration also creates a notification") out of the raw query modules, so Models stay pure "run this SQL" functions.

- **Models** — `models/userModel.js`, `models/eventModel.js`, etc. Each exports functions that run a single parameterized query and return rows. No business logic, no HTTP awareness.
- **Views** — EJS templates under `views/`, grouped by feature (`auth/`, `events/`, `donations/`, `admin/`, `dashboard/`), with shared `layouts/` and `partials/`.
- **Controllers** — thin; one per resource; split into `controllers/web/` (renders EJS) and `controllers/api/` (returns JSON).
- **Services** — business logic and multi-model orchestration (`eventService.js`, `registrationService.js`, `attendanceService.js`, `donationService.js`, `certificateService.js`, `reportService.js`).
- **Middlewares** — `verifyJwt.js`, `requireRole.js`, `validate.js`, `errorHandler.js`, `upload.js` (multer config).
- **Routes** — `routes/web/*` and `routes/api/v1/*`, mounted in `app.js`.

---

## 3. Complete Feature List (trimmed to approved scope)

**User Authentication**
- Register, log in, log out (JWT issued as httpOnly cookie), log out of all devices (bumps `token_version`)
- Email verification, password reset (separate short-lived one-time tokens — distinct from the JWT)
- Two roles: `admin`, `user`

**User Dashboard** (role: `user`)
- Browse/search/filter published events
- Apply to volunteer for an event; withdraw application
- View own registration status (pending/approved/rejected)
- View own attendance history and accumulated volunteer hours
- View/download own certificates
- Record/view own donations and donation history
- View own notifications

**Admin Dashboard** (role: `admin`)
- At-a-glance summary widgets: total users, upcoming events, pending registration approvals, total donations recorded, certificates issued this month
- Quick links into Event Management, Volunteer Registration approvals, Attendance Tracking, Donation Recording, Reports

**Event Management** (admin)
- Create/edit/publish/cancel events (title, description, category, location, schedule, capacity, banner image)
- Manage event categories (lookup list)
- Public event listing with search/filter (category, date, location) for all visitors

**Volunteer Registration**
- User applies to an event (subject to capacity)
- Admin approves/rejects applications
- User can withdraw a pending/approved application before the event

**Attendance Tracking** (admin, per event)
- Mark a registered volunteer as attended / no-show at/after the event
- Record hours contributed per attendee
- Attendance status feeds directly into certificate eligibility

**Donation Recording and Tracking**
- Admin (or the donor themselves) records a donation: amount, currency, optional linked event (nullable — general donations allowed), donor identity or anonymous, free-text payment method (cash/bank transfer/other — descriptive only, **no payment processing**), optional notes
- Donation history per user, per event, and platform-wide
- Aggregate tracking (totals by event / date range / donor) surfaced through Reports

**Certificate Generation**
- Auto-generate a PDF certificate once a user's attendance for an event is verified (`attended` status)
- Unique certificate number per issuance
- User can view/download; admin can re-issue if needed

**Notifications**
- In-app notifications: registration approved/rejected, event reminder, certificate ready, donation recorded/acknowledged
- Email notifications for the same events (Nodemailer)

**Reports** (admin)
- Event participation report (registrations vs. capacity, attendance rate) per event
- Volunteer hours report (per user, per event, per date range)
- Donation summary report (totals by event, by date range, by donor, including anonymous aggregate)
- Certificate issuance report
- Exportable as CSV and/or PDF

---

## 4. User Roles and Permissions

Two roles only (see design note in Section 0.1):

| Capability | Guest | User | Admin |
|---|---|---|---|
| Browse public events | ✅ | ✅ | ✅ |
| Register/login | ✅ (to become User) | – | – |
| Apply/withdraw to volunteer for an event | ❌ | ✅ | ✅ |
| View own registration status, hours, certificates | ❌ | ✅ | – |
| Record own donation | ❌ | ✅ | ✅ |
| View own donation history | ❌ | ✅ | – |
| Create/edit/publish/cancel events | ❌ | ❌ | ✅ |
| Manage event categories | ❌ | ❌ | ✅ |
| Approve/reject volunteer registrations | ❌ | ❌ | ✅ |
| Mark attendance / record hours | ❌ | ❌ | ✅ |
| Record a donation on behalf of a walk-in/anonymous donor | ❌ | ❌ | ✅ |
| Generate/re-issue certificates | ❌ | ❌ | ✅ |
| View platform-wide reports | ❌ | ❌ | ✅ |
| Manage users (suspend, force logout, role change) | ❌ | ❌ | ✅ |

Enforced via a `role` column on `User` (`admin` / `user`) checked in `requireRole()` middleware — never trusted client-side.

---

## 5. Database Entities and Relationships

### Core Entities

- **User** — id, name, email (unique), password_hash, role (`admin`/`user`), phone, profile_photo_key, status (`active`/`suspended`), token_version (int, default 0), email_verified_at, created_at, updated_at
- **EventCategory** — id, name (lookup: Cleanup, Fundraiser, Relief, Education, Awareness…)
- **Event** — id, category_id (FK), title, description, location, start_datetime, end_datetime, capacity, banner_image_key, status (`draft`/`published`/`cancelled`/`completed`), created_by (FK → User, admin), created_at
- **EventRegistration** — id, event_id (FK), user_id (FK), status (`pending`/`approved`/`rejected`/`withdrawn`), applied_at, decided_by (FK → User, nullable), decided_at
- **Attendance** — id, event_registration_id (FK, unique), status (`attended`/`no_show`), hours_contributed (numeric), marked_by (FK → User, admin), marked_at
  *(kept as its own table, separate from `EventRegistration`, so "Attendance Tracking" is a clean, independently testable module even though it always has exactly one row per registration)*
- **Donation** — id, event_id (FK, nullable — null = general/undesignated donation), donor_id (FK → User, nullable if anonymous or walk-in), donor_name (free text, used when no donor_id — anonymous/walk-in), amount, currency, payment_method (free text: cash/bank_transfer/other), is_anonymous, notes, recorded_by (FK → User, admin — null if self-recorded by the donor), donated_at, created_at
- **Certificate** — id, user_id (FK), event_id (FK), certificate_number (unique), issued_at, file_key
- **Notification** — id, user_id (FK), type, message, related_entity_type, related_entity_id, is_read, created_at
- **AuditLog** — id, actor_id (FK → User), action, entity_type, entity_id, metadata (jsonb), created_at
- **PasswordResetToken** / **EmailVerificationToken** — id, user_id (FK), token_hash, expires_at, used_at
  *(unrelated to the JWT access token — these are one-time-use links sent by email)*

### Relationship Summary

```
User ──< EventRegistration >── Event ──> EventCategory
EventRegistration ──1:1── Attendance
User ──< Donation (as donor, nullable) >── Event (nullable)
User ──< Certificate >── Event
User ──< Notification
User ──< AuditLog (as actor)
User ──< PasswordResetToken / EmailVerificationToken
```

Removed since v1: `Organization`, `OrganizationMember`, `DonationCampaign`, `Transaction`, `Feedback`.

File fields (`profile_photo_key`, `banner_image_key`, `file_key`) still store a storage **key**, not a path/URL, to keep local-disk-to-S3-later a config change, not a schema change.

A visual ERD (`docs/ERD.png`) should still be drawn (e.g. dbdiagram.io) before writing the schema migration — recommend doing that as the first concrete step of Phase 0.

---

## 6. Recommended Folder Structure

```
project-root/
├── src/
│   ├── config/                # db.js (pg Pool setup), env.js, constants.js, jwt.js
│   ├── models/                # one file per entity — parameterized SQL via pg, no ORM
│   ├── services/               # business logic (eventService, registrationService,
│   │                             attendanceService, donationService, certificateService,
│   │                             reportService, notificationService)
│   ├── controllers/
│   │   ├── web/                 # renders EJS views
│   │   └── api/                  # returns JSON (/api/v1)
│   ├── routes/
│   │   ├── web/
│   │   └── api/
│   ├── middlewares/             # verifyJwt.js, requireRole.js, validate.js,
│   │                             errorHandler.js, upload.js, csrf.js
│   ├── validators/              # request schemas (express-validator/zod)
│   ├── views/
│   │   ├── layouts/
│   │   ├── partials/
│   │   └── pages/                 # auth/, events/, donations/, dashboard/, admin/, reports/
│   ├── public/
│   │   ├── css/
│   │   ├── js/                     # client-side vanilla JS
│   │   └── images/
│   ├── utils/                     # logger, storage adapter, mailer adapter, pdfGenerator,
│   │                                csvExporter, tokenService (sign/verify JWT)
│   ├── jobs/                       # node-cron: event reminders, auto-complete past events
│   └── app.js
├── database/
│   ├── migrations/                # node-pg-migrate migration files (plain SQL/JS)
│   └── seeders/                    # plain SQL/JS seed scripts (dev + test data)
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
│   ├── PROJECT_BLUEPRINT.md       (this file)
│   ├── API.md
│   └── ERD.png
├── .env.example
├── .eslintrc.json / .prettierrc
├── package.json
└── server.js
```

---

## 7. Development Roadmap (Module-by-Module)

| Phase | Module | Key deliverables |
|---|---|---|
| 0 | Scaffolding | Repo structure, ESLint/Prettier, `.env` config, `pg` Pool setup, `node-pg-migrate` wired up, base Express app, centralized error handler, logging |
| 1 | User Authentication | Register, login (issue JWT httpOnly cookie), logout, logout-everywhere (`token_version` bump), email verification, password reset, `verifyJwt`/`requireRole` middleware |
| 2 | Event Management | Event + EventCategory CRUD (admin), public listing/search/filter, banner upload |
| 3 | Volunteer Registration | Apply/withdraw, admin approve/reject, capacity enforcement |
| 4 | Attendance Tracking | Mark attended/no-show, record hours, ties into registration status |
| 5 | Donation Recording & Tracking | Record donation (admin or self), donation history views, aggregate queries |
| 6 | Certificate Generation | PDF generation on verified attendance, unique numbering, download endpoint |
| 7 | Notifications | In-app notification center + Nodemailer emails, event-reminder cron job |
| 8 | Admin Dashboard | Summary widgets pulling from services above |
| 9 | User Dashboard | Personal registrations/hours/certificates/donations views |
| 10 | Reports | Filterable/exportable event, volunteer-hours, donation, and certificate reports (CSV/PDF) |
| 11 | Security Hardening | Helmet, rate limiting, CSRF, input sanitization pass, JWT edge-case testing (expiry, suspension, forced logout), dependency audit |
| 12 | Testing | Unit + integration test suite, coverage review, manual QA checklist against Section 4's role matrix |
| 13 | Deployment Prep | Dockerfile, environment-based config validation, README/runbook — actual AWS/Render choice deferred |

Each phase should be demoable end-to-end (DB → service → controller → view/API) before moving to the next.

---

## 8. Recommended npm Packages

| Package | Purpose |
|---|---|
| `express` | Core web framework / router |
| `pg` | PostgreSQL driver — all queries are hand-written, parameterized SQL |
| `node-pg-migrate` | Schema migration runner (not an ORM/query-builder — just versions and applies your SQL) |
| `ejs` | View templating engine |
| `dotenv` | Environment variable loading |
| `bcrypt` | Password hashing |
| `jsonwebtoken` | Sign/verify JWT access tokens |
| `cookie-parser` | Read the JWT from the httpOnly cookie on incoming requests |
| `express-validator` (or `zod`) | Request input validation |
| `helmet` | Secure HTTP headers |
| `express-rate-limit` | Brute-force/rate limiting on auth & donation-recording endpoints |
| CSRF library — `csrf-csrf` or `lusca` | CSRF protection for cookie-carried auth (`csurf` is deprecated — use a maintained alternative) |
| `multer` | Multipart file uploads (event banners, profile photos) |
| `morgan` | HTTP request logging |
| `winston` | Structured application logging |
| `nodemailer` | Verification/notification emails |
| `node-cron` | Scheduled jobs (event reminders, marking past events completed) |
| `pdfkit` | Certificate PDF generation + PDF report export |
| `json2csv` (or `csv-writer`) | CSV export for Reports module |
| `uuid` | Unique tokens / certificate numbers |
| `dayjs` | Date/time handling |
| `compression` | Gzip response compression |
| `sanitize-html` | Sanitizing any free-text user input (event descriptions, donation notes) |
| `hpp` | HTTP parameter pollution protection |
| `jest` + `supertest` | Unit + integration testing |
| `eslint` + `prettier` | Code quality/consistency |
| `nodemon` (dev only) | Auto-restart during development |

Removed from v1: `sequelize`, `sequelize-cli`, `knex`, `express-session`, `connect-pg-simple`, and any payment gateway SDK.

---

## 9. Security Architecture

- **Password storage**: bcrypt (cost factor ≥ 10).
- **JWT access token**: signed (HS256 with a strong secret, or RS256 if you want asymmetric verification later), short expiry (~2h), carried in an `httpOnly`, `secure`, `sameSite=strict` cookie. Verified on every request by `verifyJwt` middleware — no DB hit required for signature/expiry checks.
- **Revocation**: `token_version` claim embedded at issuance, compared against the live `User.token_version` column; bumping it (suspend, password change, "log out everywhere") invalidates all outstanding tokens for that user immediately.
- **RBAC middleware** (`requireRole('admin')`): every protected route explicitly declares the required role; never inferred client-side.
- **CSRF protection retained**: because the JWT rides in an ambient cookie, state-changing requests still need CSRF tokens on forms/AJAX calls — this is the direct trade-off of choosing cookie-based JWT over header-based, and is non-optional here.
- **Input validation everywhere a request enters the system** (`express-validator`/`zod` schemas per route).
- **SQL injection prevention**: every query is parameterized (`pool.query('... WHERE id = $1', [id])`) — no string-concatenated SQL, ever. This is the main discipline the "no ORM" choice pushes onto the team; code review should treat any concatenated SQL string as a blocking issue.
- **XSS prevention**: EJS auto-escapes by default (`<%= %>`); never use `<%- %>` on user-supplied content; sanitize free-text fields server-side too (`sanitize-html`).
- **File upload safety**: MIME/extension whitelist, size cap, server-generated filenames, stored outside any executable web path.
- **Rate limiting** on login, registration, password reset, and donation-recording endpoints.
- **HTTP security headers** via `helmet` (CSP, X-Frame-Options, HSTS in production).
- **Secrets management**: `.env` locally (never committed), environment-variable injection at deploy time later.
- **Least-privilege DB user** for the app; separate migration-runner credentials where possible.
- **Audit logging** for sensitive actions: registration approval/rejection, attendance marking, donation recording, certificate issuance, user suspension/role changes.
- **No payment data of any kind is collected or stored** — the Donation model is a manual ledger entry, not a payment integration, which removes an entire class of PCI/security concerns by design.
- **HTTPS** enforced at the reverse proxy/load balancer in production (kept out of app code to stay cloud-agnostic).
- **Dependency hygiene**: `npm audit` in CI.

---

## 10. Testing Strategy

- **Unit tests** (`jest`): services and utilities in isolation (e.g., "does `registrationService` reject an application once an event is at capacity", "does `certificateService` refuse to generate a certificate for a `no_show` attendance record"). Models can be tested against a real test database rather than mocked, since they're just thin SQL wrappers — mocking raw `pg` calls has low value.
- **Integration tests** (`jest` + `supertest`): real Express routes against a dedicated test PostgreSQL database; reset state between tests via transaction rollback or truncate+reseed scripts in `database/seeders/`.
- **E2E tests** (optional, Playwright/Cypress) for the critical paths: register → apply to event → admin approves → admin marks attended → certificate generated and downloadable; and record donation → appears in donation history → appears in donation report.
- **JWT-specific test cases**: expired token rejected, tampered signature rejected, suspended user's token rejected via `token_version` mismatch, role-mismatched access to admin routes rejected.
- **CI**: GitHub Actions running lint + unit + integration tests on every push/PR.
- **Manual QA checklist** per phase milestone, covering the two-role permission matrix in Section 4.
- **Coverage focus**: services, middlewares, and SQL-parameterization correctness (security-critical) over blanket percentage across views/boilerplate.

---

## Confirmed Decisions (locked)

1. Migration tool: **`node-pg-migrate`**.
2. JWT: httpOnly-cookie architecture as designed in Section 0.1/9, **2-hour access token expiry**.
3. Scope as defined in Section 3 is final — Organizations, Feedback/Ratings, and Campaigns remain out of scope.

This document is the approved foundation for implementation. No code has been written yet — awaiting the go-ahead to begin Phase 0 (scaffolding).
