# Phase 6 — Attendance Tracking Module

Status: implemented and verified end-to-end against the running dev server and the live
PostgreSQL database — every rule (registration-required, duplicate prevention, hour calculation
via both the check-out path and the direct-mark path, statistics, RBAC) was exercised with real
HTTP requests. Scope is exactly Attendance Tracking — no Donation Management, Certificate
Generation, Reports, or deployment work.

---

## 1. Schema Change

One new migration, on top of the Phase 1 `attendance` table (which already had `status`,
`hours_contributed`, `marked_by`, `marked_at`, and the `UNIQUE(event_registration_id)` constraint
that makes "one attendance record per volunteer per event" a database guarantee, not just an
application-layer promise):

`database/migrations/1751500014_add-attendance-check-in-out-times.js`:

- Adds `check_in_time timestamptz` and `check_out_time timestamptz` (both nullable — a volunteer
  marked Present/Absent directly, without a live check-in/check-out, never gets real timestamps).
- Adds `CHECK (check_out_time IS NULL OR check_in_time IS NULL OR check_out_time >= check_in_time)`
  — defense in depth alongside the service-layer check of the same rule.

Applied and verified against the live database before any application code was written, same as
every prior schema change in this project.

---

## 2. What Was Built

**Model** — `src/models/attendanceModel.js`: `findByRegistrationId`, `findById`, `checkIn`,
`checkOut`, `markPresent`, `markAbsent`, `update` (the admin correction path), `listForEvent`
(admin's per-event roster — every *approved* registration, left-joined with its attendance record
so a missing record naturally reads as "pending"), `getEventStats`, `getTotalHoursForUser`,
`listHistoryForUser`.

**Service** — `src/services/attendanceService.js`: `checkIn`, `checkOut`, `markPresent`,
`markAbsent`, `editAttendance`, and an `AttendanceError` class (mirrors `EventError`/
`RegistrationError` from earlier phases). This is where every business rule lives:

- **System requirement #1** ("only registered volunteers may have attendance recorded"): every
  action first confirms the volunteer has an `approved` `event_registrations` row.
- **System requirements #2/#3** (no duplicates, one record per volunteer per event): `checkIn`,
  `markPresent`, and `markAbsent` all check for an existing attendance row first and reject with a
  clear message ("...Use Edit to make corrections.") — and, as a safety net for a race between
  that check and the insert, catch a Postgres unique-violation (`23505`) from the model and turn
  it into the same friendly error, the same defensive pattern `authService.register` used back in
  Phase 2.
- **System requirement #4** (auto-calculate hours after check-out): `checkOut` computes
  `hours = (check_out_time - check_in_time) / 1h`, rounded to 2 decimals.
- **Admin feature #5** (auto-calculate hours from the event's start/end time): `markPresent` — the
  direct-mark path with no live check-in/check-out — computes hours from `event.start_datetime`/
  `event.end_datetime` instead, since there's nothing else to measure from.
- **Admin feature #6** (edit/correct records): `editAttendance` lets an admin rewrite status,
  timestamps, and hours. If both a check-in and check-out time are supplied, hours are recomputed
  from them (single source of truth, verified in testing to correctly override a manually-typed
  hours value); if not, the admin's typed hours value is used directly.

**Controllers**
- `src/controllers/web/adminAttendanceController.js` — `list` (roster + stats), `checkIn`,
  `checkOut`, `markPresent`, `markAbsent` (all built from one small `makeAction()` factory, since
  the four actions share an identical "parse ids → call the service → flash-redirect" shape),
  `showEditForm`, `update`.
- `src/controllers/web/attendanceController.js` — `myAttendance` ("My Volunteer Hours": total
  hours + history).

**Routes**
- `src/routes/web/attendanceRoutes.js` — `GET /my-attendance`, behind `verifyJwt` only.
- `src/routes/web/adminEventRoutes.js` (modified) — gained
  `GET /:id/attendance`, `POST /:id/attendance/:registrationId/{check-in,check-out,mark-present,mark-absent}`,
  `GET`/`POST /:id/attendance/:registrationId/edit`, all under the router's existing
  `requireRole('admin')` (this router is mounted at `/admin/events` since the Phase 5 routing fix —
  see that phase's docs for why mount point matters here).

**Views**
- `src/views/pages/admin/events/attendance.ejs` — roster table (volunteer, email, check-in,
  check-out, hours, status badge, contextual action buttons) + a 4-stat summary row (Present,
  Absent, Pending, Total Hours).
- `src/views/pages/admin/events/attendanceEdit.ejs` — the correction form (status, check-in/out
  `datetime-local` inputs, hours).
- `src/views/pages/attendance/my.ejs` — "My Volunteer Hours": a total-hours summary card + a
  history table.
- `src/views/partials/attendanceStatusBadge.ejs` (new) — the three-state colored badge described
  below.

**Modified for integration** (per the instructions' allowance — "unless required for Attendance
integration"):
- `src/models/registrationModel.js`'s `listForUser` gained a `LEFT JOIN attendance` and an
  `attendance_status` column, so "My Registered Events" can show an attendance badge per row
  without a second query.
- `src/views/pages/registrations/my.ejs` gained an "Attendance" column using that new field
  (Present/Absent/Pending for active registrations, an em-dash for cancelled ones — attendance
  status isn't meaningful for a registration that was withdrawn).
- `src/views/pages/admin/events/view.ejs` gained an "Attendance" button next to the existing
  "Volunteers" button.
- `src/services/dashboardService.js` — the "My Volunteer Hours" placeholder card is now live
  (total hours, linking to `/my-attendance`), the same pattern every prior phase has followed for
  its own newly-implemented feature.
- `src/config/navigation.js` — the user sidebar's "My Volunteer Hours" entry now links to
  `/my-attendance` instead of being disabled.

No other completed module's files were touched.

---

## 3. The Colored Status Badge

`partials/attendanceStatusBadge.ejs` — three states, reusing the exact same badge classes as
Phase 5's registration badge (per the instruction to reuse existing badge components rather than
invent new ones):

| `attendanceStatus` | Label | Class | Meaning |
|---|---|---|---|
| `present` | Present | `badge-success` (green) | `attendance.status = 'attended'` |
| `absent` | Absent | `badge-danger` (red) | `attendance.status = 'no_show'` |
| `pending` | Pending | `badge-warning` (orange) | No attendance row exists yet |

Used in three places: the admin roster page, "My Registered Events" (Phase 5's page, integrated),
and "My Volunteer Hours" history table.

---

## 4. Design Notes

- **Why "Present" appears immediately on check-in, before check-out**: the volunteer genuinely is
  present at that moment; only `hours_contributed` is unfinalized (`0` until check-out). The
  roster page distinguishes an in-progress check-in from a completed one by whether a Check-Out
  button is still showing, not by a fourth badge color — the instructions specify exactly three
  states, so a 4th "checked in, not yet out" color was deliberately not invented.
- **Why check-in/mark-present/mark-absent all *require* no existing record, pushing corrections
  through Edit**: this is the literal reading of "prevent duplicate attendance records" — rather
  than silently overwriting on repeated clicks, the first-time actions are one-shot, and
  "Edit attendance records if corrections are required" (its own listed admin feature) is the one
  and only path for changing an already-recorded outcome.
- **Why re-registering after a withdrawal doesn't resurrect old attendance**: `attendance` rows are
  tied to a specific `event_registrations.id` via a real foreign key with `ON DELETE CASCADE`.
  Phase 5's `reactivate()` reuses the *same* registration row (rather than creating a new one), so
  if a volunteer had attendance recorded, cancelled, and re-registered, that history is still tied
  to the same registration id — this wasn't re-tested in this phase since it's Phase 5 behavior,
  noted here only because it explains why the foreign key points at the registration, not the
  user+event pair directly.
- **Known simplification — no row-level locking**, same caveat as Phase 5's registration service:
  check-then-write, not a transaction with `SELECT ... FOR UPDATE`. The `UNIQUE(event_registration_id)`
  constraint is what actually prevents a duplicate row even under a race; the pre-check just gives
  a friendlier error in the common case.

---

## 5. Test Results (this session)

All run against the live app and the live seeded database, using one throwaway 8-hour test event
and the two seeded volunteer accounts:

| # | Test | Result |
|---|---|---|
| 1 | Both volunteers show "Pending" before any action | Confirmed — orange badge, no attendance row |
| 2 | Check-in | `302` success flash; row created with `status='attended'`, `check_in_time` set, `hours_contributed='0.00'` |
| 3 | Duplicate check-in on the same volunteer | Blocked: "Attendance has already been recorded...Use Edit to make corrections." |
| 4 | Check-out on a volunteer never checked in | Blocked: "This volunteer has not been checked in yet." |
| 5 | Check-out (successful) | Hours computed from the real elapsed time (verified the formula is correct — a 14-second test gap correctly rounds to `0.00`, distinct from a bug) |
| 6 | Mark Present (direct path, no check-in/out) | Hours computed from the event's own 8-hour scheduled duration → `8.00`, confirmed |
| 7 | Duplicate Mark Present / Mark Absent on an already-recorded volunteer | Both blocked with the same "already recorded" message |
| 8 | Edit: change to Absent | `status='no_show'`, timestamps and hours all zeroed/nulled |
| 9 | Edit: change back to Present with explicit check-in/out times **and** a manually-typed hours value of `99` | Hours correctly recomputed from the timestamps (`4.50`), the manual `99` correctly ignored |
| 10 | Edit: check-out time before check-in time | Rejected — "Check-out time must be after check-in time." |
| 11 | Edit: invalid status value | Rejected — "Please select a valid attendance status." |
| 12 | Event attendance statistics | Present/Absent/Pending/Total Hours all matched the live state at each step |
| 13 | RBAC: regular user on any `/admin/events/*/attendance*` route | `403` on every one |
| 14 | RBAC: admin on the same routes | `200`/`302` as expected |
| 15 | "My Registered Events" (Phase 5 page) shows the new Attendance column | Correct Present badge for a checked-in volunteer |
| 16 | "My Volunteer Hours" page | Correct total hours and history row per volunteer |
| 17 | Dashboard "My Volunteer Hours" card | Live value matched the volunteer's actual total hours |
| 18 | Error handling: check-in for a non-existent registration id | Graceful flash error, not a crash |
| 19 | Error handling: malformed (non-numeric) ids in the URL | `404`, not a raw SQL error |
| 20 | Error handling: non-existent event id | `404` |

Database confirmed unchanged after testing — the one throwaway event was deleted, and its
`ON DELETE CASCADE` chain (`events → event_registrations → attendance`) automatically cleaned up
every registration and attendance row it had created, restoring the exact Phase 1 baseline (0
events, 0 registrations, 0 attendance rows, 3 seeded users, 3 categories).

---

## 6. How To Test This Yourself

```bash
npm run migrate:up   # applies the check_in_time/check_out_time migration if not already run
npm run dev
```

**As the admin** (`admin@communityconnect.local` / `ChangeMe123!`): create or open a published
event with at least one approved volunteer registration, click **Attendance** on its detail page.
For a volunteer still Pending, you can **Check In**, **Mark Present**, or **Mark Absent**. Once
checked in (not yet out), a **Check Out** button appears — click it to see hours calculated from
the real elapsed time. Once any outcome is recorded, only **Edit** remains, letting you correct
the status, times, or hours.

**As a volunteer** (`aisha.khan@communityconnect.local` / `ChangeMe123!`): visit
`/my-registrations` to see your attendance status per event, or click **My Volunteer Hours** in
the sidebar (now live) to see your total hours and full history.

**Authorization**: while logged in as the volunteer, try navigating directly to
`/admin/events/<id>/attendance` — you'll get a 403 page.

---

## Not Yet Implemented (by design, per this phase's scope)

Donation Management, Certificate Generation, Reports, deployment. No changes were made to any
completed module beyond the integration points listed in Section 2.
