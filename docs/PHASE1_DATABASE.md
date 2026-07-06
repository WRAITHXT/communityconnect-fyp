# Phase 1 — Database Design

Status: schema implemented, migrated, and seeded against a live local PostgreSQL 18 instance
(`communityconnect_fyp`). No models, controllers, services, routes, or application queries exist
yet — this phase is the schema only, per `docs/PROJECT_BLUEPRINT.md`.

Diagram: [`docs/ERD.md`](ERD.md). Migration files: `database/migrations/`. Seed script:
`database/seeders/001-initial-seed.js`.

---

## 1. Tables

### `users`
The single account table for both roles (`admin`, `user` — see blueprint Section 0.1's two-role
decision). Holds identity, credentials, and the fields that make JWT revocation possible.

| Column | Notes |
|---|---|
| `id` | Surrogate PK, `serial`. |
| `name`, `email`, `password_hash` | Core identity/credential fields. `email` is unique — it's the login key. |
| `role` | `admin` \| `user`. Checked, not a separate lookup table — only two fixed values, a lookup table would be pure overhead. |
| `phone`, `profile_photo_key` | Optional profile fields. `profile_photo_key` is a storage key, not a path/URL (cloud-agnostic — see blueprint Section 1). |
| `status` | `active` \| `suspended`. An admin suspending a user sets this and should bump `token_version` in the same operation (application-layer rule, Phase 1: Authentication). |
| `token_version` | Starts at `0`. Incremented to invalidate every JWT issued before that point — the revocation mechanism the blueprint's JWT design depends on, without a session/blocklist table. |
| `email_verified_at` | Null until verified; nullable timestamp doubles as a boolean + audit trail. |
| `created_at`, `updated_at` | `updated_at` is maintained by the `set_updated_at` trigger (see below), not by application code. |

### `event_categories`
A small lookup table (Cleanup Drive, Fundraiser, Awareness Campaign, ...). Kept separate from
`events.category` (a free-text column) so category names are managed once and events reference
them by id — prevents "Cleanup", "cleanup", "Clean-up" drift across events.

### `events`
One row per event. `category_id` and `created_by` are required (`NOT NULL`) — every event has
exactly one category and one creating admin. `status` drives the event lifecycle
(`draft → published → cancelled/completed`).

### `event_registrations`
A user's application to volunteer at an event. `status` tracks the approval workflow
(`pending → approved/rejected`, or `withdrawn` by the user). `decided_by`/`decided_at` capture
which admin approved/rejected it and when — nullable because a `pending` registration hasn't been
decided yet.

### `attendance`
Deliberately a separate table from `event_registrations` rather than extra columns on it (per
blueprint Section 5) — it's the record of what actually happened at the event (did they show up,
how many hours), owned by the Attendance Tracking module, versus `event_registrations` which is
owned by the Volunteer Registration module. The 1:1 relationship is enforced at the database level
(see Constraints).

### `donations`
A manual ledger entry — recording only, no payment processing (per your Phase 1 blueprint
instruction and the earlier "donations are recording-only" decision). `event_id` and `donor_id`
are both nullable: a donation can be undesignated (no event) and/or from a walk-in donor with no
account (`donor_name` used instead). `payment_method` is a descriptive enum
(`cash`/`bank_transfer`/`other`), not a payment gateway integration.

### `certificates`
One certificate per user per event, generated after attendance is verified (application-layer
rule enforced in the Certificate Generation phase — the schema only guarantees uniqueness, not the
business condition). `certificate_number` is the human-facing unique identifier printed on the PDF.

### `notifications`
In-app notifications. `related_entity_type`/`related_entity_id` is a deliberate, documented
polymorphic reference (can point at an event, registration, donation, or certificate) — see the
comment in its migration file for why this isn't a foreign key.

### `audit_logs`
Records sensitive actions (registration decisions, attendance marking, donation recording,
certificate issuance, suspensions) for the Admin Dashboard/Reports modules. `actor_id` is nullable
via `ON DELETE SET NULL` so the log entry survives even if the acting account is later deleted.

### `password_reset_tokens` / `email_verification_tokens`
Two structurally identical tables for one-time-use links emailed to users. Kept separate (rather
than one generic "tokens" table with a `type` column) because they have different lifecycles and
it keeps `WHERE` clauses on each simple; the duplication is two small tables, not a normalization
problem (see Section 4). Only a hash of the token is stored, never the raw value.

---

## 2. Relationships

- **`event_categories` 1—* `events`** — every event belongs to exactly one category; a category
  can have many events. `RESTRICT` on delete (see Constraints).
- **`users` 1—* `events` (as creator)** — `events.created_by`. An admin can create many events.
- **`users` 1—* `event_registrations` *—1 `events`** — the core many-to-many between users and
  events (who applied to what), resolved through this junction table, with `status` as the
  workflow state living on the join itself rather than needing a separate state table.
- **`users` 1—* `event_registrations` (as decider)** — `decided_by`, a second, independent
  relationship between the same two tables (an admin decides many registrations).
- **`event_registrations` 1—1 `attendance`** — every attendance record belongs to exactly one
  registration, and a registration has at most one attendance record.
- **`users` 1—* `attendance` (as marker)** — the admin who recorded it.
- **`events` 1—* `donations`, `users` 1—* `donations` (as donor), `users` 1—* `donations` (as
  recorder)** — three independent, all-nullable relationships into the same table, reflecting
  that a donation may be undesignated, anonymous/walk-in, and/or self-recorded.
- **`users` 1—* `certificates` *—1 `events`** — a certificate always names exactly one user and
  one event.
- **`users` 1—* `notifications`** — standard one-to-many.
- **`users` 1—* `audit_logs` (as actor, nullable)**.
- **`users` 1—* `password_reset_tokens`**, **`users` 1—* `email_verification_tokens`** — a user
  can request multiple tokens over time (old ones simply expire/get marked `used_at`).

No table has a many-to-many relationship implemented as a plain junction without its own identity
— `event_registrations` is the one place that looks like a junction table, but it has enough of
its own attributes (`status`, `applied_at`, `decided_by`, `decided_at`) that it's a first-class
entity, not a pure link table.

---

## 3. Constraints

**Primary keys** — every table has a single-column `serial` surrogate `id`. Chosen over UUIDs for
simplicity (sequential, human-readable in logs/URLs during development); revisit only if you
later need globally-unguessable identifiers (e.g., certificate numbers already serve that role
where it matters, via their own `UNIQUE` text column, not the PK).

**Foreign keys and cascade rules** — every FK has an explicit `onDelete` action, chosen per
relationship rather than left at the default:

| Rule | Used where | Why |
|---|---|---|
| `RESTRICT` | `events.category_id`, `events.created_by`, `attendance.marked_by` | Protects data that other rows depend on for meaning or audit purposes — you must reassign/remove dependents before deleting the referenced row. |
| `CASCADE` | `event_registrations.event_id`/`user_id`, `attendance.event_registration_id`, `certificates.user_id`/`event_id`, `notifications.user_id`, `password_reset_tokens.user_id`, `email_verification_tokens.user_id` | The child row has no independent meaning once its parent is gone. |
| `SET NULL` | `event_registrations.decided_by`, `donations.event_id`/`donor_id`/`recorded_by`, `audit_logs.actor_id` | The child row's history/data must outlive the referenced row; only the attribution is lost, not the record. |

This is the same table reproduced from the migration file comments, collected here for a single
place to review the cascade design as a whole.

**Unique constraints**
- `users.email`, `event_categories.name`, `certificates.certificate_number`,
  `password_reset_tokens.token_hash`, `email_verification_tokens.token_hash` — each is a natural
  key for its table.
- `event_registrations (event_id, user_id)` — a user can only have one registration per event
  (re-applying after withdrawal is an update, not a new row — an application-layer decision to
  make in Phase 3).
- `attendance (event_registration_id)` — combined with the `NOT NULL` FK, this is what makes the
  relationship to `event_registrations` truly 1:1 rather than 1-to-many.
- `certificates (user_id, event_id)` — one certificate per user per event.

**Check constraints**
- `users.role IN ('admin','user')`, `users.status IN ('active','suspended')`.
- `events.status IN (...)`, `events.capacity > 0`, `events.end_datetime > events.start_datetime`.
- `event_registrations.status IN (...)`.
- `attendance.status IN ('attended','no_show')`, `attendance.hours_contributed >= 0`.
- `donations.amount > 0`, `donations.payment_method IN ('cash','bank_transfer','other')`.

These enforce the enums and business invariants from the blueprint (Sections 3–5) at the database
level, so they hold even if application-layer validation is ever bypassed or has a bug.

**Defaults** — `now()` for every `created_at`/`applied_at`/`donated_at`/etc.; `0` for
`token_version` and `hours_contributed`; `'pending'`/`'draft'`/`'active'`/`false` for the various
status/boolean columns, matching each entity's natural starting state.

**Indexes** — beyond the automatic indexes every `UNIQUE`/`PRIMARY KEY` constraint creates,
explicit indexes were added on foreign keys (Postgres does not index FKs automatically) and on
columns the roadmap's own features will filter/sort by: `events.status`/`start_datetime` (public
listing/search), `event_registrations.status` (approval queue), `donations.donated_at` (date-range
reports), `notifications (user_id, is_read)` (unread-count queries), `audit_logs
(entity_type, entity_id)` (looking up a specific record's history).

**The `set_updated_at` trigger** — one shared Postgres function, attached to `users` and `events`
(the only two tables with an `updated_at` column), so "last modified" is maintained by the
database itself and can never drift out of sync with an application-layer bug that forgets to set
it on an `UPDATE`.

---

## 4. Running the Migrations

```bash
# apply every migration that hasn't run yet, in order
npm run migrate:up

# roll back the most recent migration
npm run migrate:down

# roll back N migrations, e.g. the last 3
npx node-pg-migrate down 3 -m database/migrations

# scaffold a new, empty migration file for a future phase
npm run migrate:create -- add-something
```

Requirements: `DATABASE_URL` in `.env` must point at an existing PostgreSQL database (the
migration tool creates tables, not the database itself — create the database first, e.g. via
`createdb` or pgAdmin). `node-pg-migrate` tracks which migrations have already run in a
`pgmigrations` table it manages automatically, so `migrate:up` is always safe to re-run — it only
applies what's new.

This was verified end-to-end in this session against a real local PostgreSQL 18 instance: all 12
migrations applied cleanly, a rollback + re-apply of the last migration was tested to confirm
reversibility, and the final schema was inspected directly (11 application tables, correct FK
cascade actions, all confirmed via `pg_constraint`).

## 5. Seeding the Database

```bash
npm run seed
```

Runs `database/seeders/001-initial-seed.js`, which inserts exactly what Phase 1 asked for — one
admin, two users, three event categories — and nothing else (no events/registrations/
donations/certificates). It's idempotent: every insert uses `ON CONFLICT ... DO NOTHING` against
the same unique constraints defined above, so running it again is a no-op rather than an error or
a duplicate.

Seeded accounts (all share one password for now, since login doesn't exist yet — this is purely
test data for the next phase to authenticate against):

| Name | Email | Role |
|---|---|---|
| Platform Admin | `admin@communityconnect.local` | admin |
| Aisha Khan | `aisha.khan@communityconnect.local` | user |
| Bilal Ahmed | `bilal.ahmed@communityconnect.local` | user |

Password for all three: `ChangeMe123!` (bcrypt-hashed in the database — printed in plaintext only
to the console when the seed script runs, for your own reference during development).

Event categories seeded: **Cleanup Drive**, **Fundraiser**, **Awareness Campaign**.

---

## 6. Normalization Review

**1NF (atomic values, no repeating groups):** every column holds a single scalar value. The one
column that looks like it could violate this — `audit_logs.metadata jsonb` — is a deliberate
exception: it stores a variable, action-specific payload (e.g., "what changed" for an audit entry)
that has no fixed shape across different action types, so modeling it as columns would mean a
different sparse column per action type. This is a standard, accepted use of `jsonb` for
genuinely variable data, not a normalization shortcut for data that should have been columns.

**2NF (no partial dependency on part of a composite key):** every table uses a single-column
surrogate primary key (`id`), so partial dependency is structurally impossible — there is no
composite PK for a non-key column to be partially dependent on. (The closest thing to a composite
key, `event_registrations (event_id, user_id)`, is a `UNIQUE` constraint, not the primary key.)

**3NF (no transitive dependency between non-key columns):** checked table by table —
- `users`: every column (name, email, role, status, etc.) describes that one user directly. No
  column depends on another non-key column.
- `events`: `title`, `capacity`, `status`, etc. all describe that one event. `category_id` is a
  foreign key, not a transitive dependency — the category *name* is not duplicated onto `events`.
- `event_registrations`, `attendance`, `donations`, `certificates`, `notifications`,
  `audit_logs`, the two token tables: each non-key column describes only that row's own subject
  (this registration, this attendance record, this donation...), not some other non-key column in
  the same row.

**Deliberate, documented departures from strict normalization** (called out so they're not
mistaken for oversights):
- `donations.donor_name` duplicates what would be `users.name` — but only for walk-in/anonymous
  donors who have no `users` row at all (`donor_id IS NULL`). It's not redundant storage of data
  that already lives elsewhere; it's the only place that data lives for that case.
- `notifications.related_entity_type` / `related_entity_id` is a polymorphic reference with no
  FK-enforced integrity, discussed in Section 3 and in the migration file's own comment. This is a
  common, accepted trade-off (avoids either a nullable FK column per possible target table, or a
  shared abstract "entities" table this schema has no other need for) — it costs referential
  integrity at the database layer in exchange for schema simplicity, not a normalization violation
  per se (it doesn't duplicate data, it just doesn't enforce a reference).

**Conclusion:** the schema is in 3NF. The two items above are conscious, narrow exceptions made
for practical reasons and documented at the point they occur, not blind spots.

---

## Not Yet Done (by design, per your instructions)

No models, controllers, services, routes, or application-level SQL exist yet. No authentication.
No `events`/`event_registrations`/`donations`/`certificates` seed data beyond the three categories
and three users requested. These begin in the next phase.
