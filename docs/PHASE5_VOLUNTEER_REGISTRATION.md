# Phase 5 — Volunteer Registration Module

Status: implemented and verified end-to-end against the running dev server and the live
PostgreSQL database — every rule (duplicate prevention, deadline enforcement, capacity
enforcement, remaining-slot recalculation, admin removal, RBAC) was exercised with real HTTP
requests, not just asserted. Scope is exactly Volunteer Registration — no Attendance Tracking,
Donation Management, Certificate Generation, or Reports.

---

## 1. No Schema Change Needed

Unlike Phases 1→4, this phase required **no new migration**. The `event_registrations` table
(created in Phase 1) already had everything this workflow needs:

- A `status` enum already including `'approved'` and `'withdrawn'`.
- `UNIQUE(event_id, user_id)` — duplicate prevention is enforced by the database itself, not just
  application logic.
- `decided_by` / `decided_at` — originally described in the blueprint for an approve/reject
  workflow. This phase doesn't implement approval (see Design Notes), so these columns are
  repurposed instead to record **who cancelled a registration**: `NULL` when the volunteer
  cancelled it themselves, the admin's user id when an admin removed it.

---

## 2. What Was Built

**Model** — `src/models/registrationModel.js`: `findByEventAndUser`, `findById`, `create`,
`reactivate` (re-approves a previously withdrawn row instead of inserting a second one, which the
UNIQUE constraint wouldn't allow anyway), `withdraw`, `listForUser` ("My Registered Events"),
`listForEvent` (admin's per-event roster, with a name/email search), `getEventStats`,
`countApprovedForUser`, `countDistinctActiveVolunteers`.

**Service** — `src/services/registrationService.js`: `registerForEvent`, `cancelRegistration`,
`adminRemoveRegistration`, `getViewerRegistrationStatus`, and a `RegistrationError` class
(mirrors `AuthError`/`EventError` from earlier phases). Holds every business rule:

- `registerForEvent` checks, **in this order**: event exists and is published → registration
  deadline hasn't passed → **the caller isn't already registered** → capacity isn't exhausted →
  then either reactivates a withdrawn row or inserts a new one. The duplicate check runs *before*
  the capacity check deliberately — a bug caught during testing (see Section 5) where a user
  retrying their own already-successful registration was told "this event is full" instead of
  "you're already registered," which is confusing (it implies someone else took the slot instead
  of their own registration being the one occupying it).
- `cancelRegistration` only lets a volunteer cancel their own active registration, and only before
  the registration deadline (per this phase's explicit instructions) — after the deadline, only an
  admin can remove them.
- `adminRemoveRegistration` is not deadline-gated and records the acting admin's id.
- Remaining-slot recalculation needed no new code at all: `eventModel`'s existing query (built in
  Phase 4, before any registrations existed) already computed
  `capacity - COUNT(approved registrations)` — it was always accurate, just always evaluated to
  `capacity` until real registrations existed. Phase 5 didn't touch that query.

**Controllers**
- `src/controllers/web/registrationController.js` — `register`, `cancel` (both volunteer-facing,
  keyed by event id, redirect with a flash message), `myRegistrations`.
- `src/controllers/web/adminRegistrationController.js` — `list` (per-event roster + stats +
  search), `remove`.
- `src/controllers/web/eventController.js` (modified) — `viewEvent` now also fetches the current
  user's registration for that event and computes `regStatus` for the badge/button decision.

**Routes**
- `src/routes/web/registrationRoutes.js` — `GET /my-registrations`, `POST /events/:id/register`,
  `POST /events/:id/cancel`, all behind `verifyJwt` only (any authenticated role).
- `src/routes/web/adminEventRoutes.js` (modified) — gained
  `GET /admin/events/:id/volunteers` and `POST /admin/events/:id/volunteers/:registrationId/remove`,
  both behind the router's existing `requireRole('admin')`. This router was also **restructured**
  — see the real bug fixed in Section 5.

**Views**
- `src/views/pages/registrations/my.ejs` — "My Registered Events" table (event, category, date,
  status badge, Cancel button when active).
- `src/views/pages/admin/events/volunteers.ejs` — per-event roster: 4 stat cards (Registered,
  Remaining Slots, Capacity, Cancelled), a name/email search bar, and a table with a Remove button
  per active registration.
- `src/views/pages/events/view.ejs` (modified) — the Phase 4 disabled "Register — Soon" button is
  now real: shows the status badge + either a Register button, a Cancel button, or an explanatory
  message, depending on `regStatus`.
- `src/views/pages/admin/events/view.ejs` (modified) — gained a "Volunteers" button linking to the
  roster page.
- `src/views/partials/registrationStatusBadge.ejs` (new) — the four-state colored badge described
  below.

**New reusable pieces (not specific to this module)**
- `src/middlewares/flash.js` + `src/views/partials/flashMessage.ejs` — a query-string-based
  one-time flash message (`?flash=...&flashType=success|error`), since this app has no server-side
  session storage to hang a traditional flash message on. Included in both layouts, so any future
  module's simple "action done" redirects can reuse it via the new
  `viewHelpers.redirectWithFlash()`.
- `src/utils/viewHelpers.js` gained `redirectWithFlash()` and `parsePositiveIntParam()` (rejects
  malformed route-param ids like `"5abc"` before they reach a SQL query as a raw driver error).

**Design system**: one new class, `.badge-neutral`, added to `components.css` for the gray
"Cancelled" state — the other three badge colors (green/red/orange) reuse the existing
`badge-success`/`badge-danger`/`badge-warning` tokens from Phase 3, per your instruction to reuse
existing badge components rather than invent new colors.

**Dashboard/sidebar integration** (same pattern as every prior phase — a placeholder becomes real
once its module exists): User Dashboard's "My Event Registrations" card is now a live count,
linking to `/my-registrations`; Admin Dashboard's "Total Volunteers" stat is now a live distinct-user
count; the sidebar's "My Registrations" (user) link is now real. The admin sidebar's "Volunteer
Registrations" entry stays a disabled placeholder — see Design Notes.

---

## 3. The Colored Status Badge

`partials/registrationStatusBadge.ejs` maps a single `regStatus` value to a label + existing badge
class:

| `regStatus` | Label | Class | Meaning |
|---|---|---|---|
| `registered` | Registered | `badge-success` (green) | Volunteer has an active registration |
| `cancelled` | Registration Cancelled | `badge-neutral` (gray) | Volunteer previously withdrew (or was removed) |
| `closed` | Registration Closed | `badge-danger` (red) | Not registered, and the deadline has passed |
| `full` | Event Full | `badge-warning` (orange) | Not registered, and capacity is exhausted |

Used in two contexts: the event detail page (`registered`/`closed`/`full`, or no badge at all when
registration is genuinely open) and "My Registered Events" (always `registered` or `cancelled`,
since every row there already has a registration record).

---

## 4. Design Notes

- **Why there's no approve/reject workflow, even though Phase 1's schema was designed for one**:
  this phase's instructions list only "Register," "Cancel," "View My Registered Events," "View
  Registration Status" for volunteers, and "View," "Search," "Remove," "View statistics" for
  admins — no "Approve Registrations" action anywhere. Registration is direct: a successful
  `POST /events/:id/register` immediately creates an `'approved'` row, counted toward capacity
  right away. `decided_by`/`decided_at` were repurposed for cancellation attribution instead of
  left unused.
- **Why admin's "Remove" is a soft withdraw, not a hard delete**: reusing the exact same
  `withdraw()` operation as a volunteer's self-cancel (just with `decided_by` set) keeps one code
  path for "this registration is no longer active" and preserves history — the volunteer's
  cancelled/removed registrations are still visible in their own "My Registered Events" list
  (as `badge-neutral` Cancelled) rather than silently vanishing.
- **Why re-registering after a withdrawal reactivates the old row instead of inserting a new
  one**: the `UNIQUE(event_id, user_id)` constraint physically prevents a second row for the same
  pair — `reactivate()` is not a nicety, it's required for re-registration to work at all.
- **Why the admin sidebar's "Volunteer Registrations" link stays disabled**: the instructions
  describe managing volunteers *per event* ("View all volunteers registered for an event"), which
  is what `/admin/events/:id/volunteers` does — reached via a button on each event's own detail
  page, not a global nav link. There's no single "every registration across every event" page in
  this phase, so activating a global sidebar link to nothing would be dishonest. A future Reports
  phase is the more natural home for a cross-event view.
- **Known simplification — no row-level locking**: `registerForEvent` does sequential
  check-then-write queries, not a database transaction with `SELECT ... FOR UPDATE`. Two truly
  simultaneous requests for the last slot could both pass the capacity check before either writes.
  The `UNIQUE(event_id, user_id)` constraint still guarantees no volunteer can ever get two rows
  for the same event, but two *different* volunteers racing for the literal last slot is not
  interlocked. Acceptable for this app's scale/demo purposes; noted here rather than silently
  glossed over.

---

## 5. A Real Bug Found and Fixed This Session

**Routing bug**: `adminEventRoutes.js` applied `router.use(verifyJwt, requireRole('admin'))` with
no path, then was mounted at the app root (`app.use('/', webAdminEventRoutes)`) alongside routes
with full absolute paths (`/admin/events`, etc.). Express runs an unpathed `router.use()` for
**every** request that reaches that router in the middleware chain — regardless of whether any
route inside it actually matches the request path. Since `webRegistrationRoutes` (new this phase)
was mounted *after* `webAdminEventRoutes`, every non-admin volunteer hitting
`POST /events/:id/register`, `POST /events/:id/cancel`, or `GET /my-registrations` was being
handed a `403` by `requireRole('admin')` before the request ever reached the routes that were
actually supposed to handle it — even though none of those paths look anything like
`/admin/events/*`.

**Fix**: restructured `adminEventRoutes.js` to use paths relative to a mount point (`/`,
`/create`, `/:id`, ...) and mount it at `app.use('/admin/events', webAdminEventRoutes)` instead of
at the root. This is the correct, idiomatic fix — the blanket auth check now only ever runs for
requests genuinely under `/admin/events`. This in turn required fixing
`viewHelpers.getAppShellLocals()`, which used `req.path` for sidebar active-link detection —
`req.path` is relative to whatever router mount point handled the request (e.g. `"/5"` inside a
router mounted at `/admin/events`), which would have broken the active-link match against a full
path like `/admin/events`. Switched to `req.originalUrl.split('?')[0]` (always the full path,
query string stripped, regardless of router nesting).

**View bug**: `admin/events/volunteers.ejs` used `include('../../partials/registrationStatusBadge', ...)`
— copied from a page one directory level shallower. Since it lives at
`pages/admin/events/volunteers.ejs` (two levels under `pages/`, not one), it needed
`../../../partials/...`. Caught immediately by the resulting 500 error page during testing and
fixed; the other three `admin/events/*.ejs` views from Phase 4 don't use `include()` so weren't
affected, and this phase's other two new views (`registrations/my.ejs`, and the modified
`events/view.ejs`) are at the correct one-level depth already.

Both bugs were caught by actually exercising the routes with `curl`, not by inspection — exactly
why this phase's testing instructions matter.

---

## 6. Test Results (this session)

All run against the live app and the live seeded database, using two throwaway test events
(capacity 1 and a past-deadline event) and the three seeded accounts:

| # | Test | Result |
|---|---|---|
| 1 | Successful registration | `302` with success flash; DB row `status='approved'`; remaining slots `1 → 0` |
| 2 | Duplicate registration (same user, same event) | Blocked with "You are already registered for this event." (after the ordering fix — see Section 5) |
| 3 | Registration when event is full (different user, capacity exhausted by #1) | Blocked with "This event has reached its maximum capacity." |
| 4 | Registration after the deadline (separate event, deadline in the past) | Blocked with "Registration is closed for this event." |
| 5 | View "My Registered Events" | Correct event/category/date, green "Registered" badge |
| 6 | Cancel a registration | `302` success flash; DB row `status='withdrawn'`, `decided_by=NULL`; remaining slots restored |
| 7 | Re-register after cancelling | Reactivates the same row (`reactivate()`), not a new one |
| 8 | Cancel after the deadline has passed | Blocked with "You can no longer cancel — the registration deadline has passed."; DB row unchanged |
| 9 | Admin views the volunteer roster for an event | Both registrants listed, correct stats (Registered/Remaining/Capacity/Cancelled) |
| 10 | Admin searches volunteers by name and by email | Each returns exactly the matching volunteer |
| 11 | Admin removes a volunteer's registration | `302` success flash; DB row `status='withdrawn'`, `decided_by=<admin's id>`; remaining slots updated |
| 12 | RBAC: regular user hits any `/admin/events/*` route (list, volunteers, remove) | `403` on every one |
| 13 | RBAC: regular user hits the volunteer-facing routes after the routing fix | `200`/`302` as expected — no longer incorrectly `403` |
| 14 | All four badge states | Verified rendered with the correct label + color: green Registered, gray Registration Cancelled, red Registration Closed, orange Event Full |
| 15 | Dashboard live stats | Admin's "Total Volunteers" and the user's "My Event Registrations" card both reflected the current state correctly at each step |

Database restored to the exact Phase 1 baseline afterward (0 events, 0 registrations, 3 seeded
users, 3 categories) — both test events (and everything cascaded from them) were deleted.

---

## 7. How To Test This Yourself

```bash
npm run dev
```

As a regular user (`aisha.khan@communityconnect.local` / `ChangeMe123!`), browse `/events`, open a
published event, and click **Register to Volunteer** — you'll see a green "Registered" badge and a
Cancel button appear in its place, and a success message at the top of the page. Visit
`/my-registrations` (now live in the sidebar) to see it listed. Try registering twice — the second
attempt is rejected with a clear message. Try cancelling — you'll get a confirmation prompt, then
land back on "My Registered Events" with the row now showing a gray "Registration Cancelled" badge.

As the admin (`admin@communityconnect.local` / `ChangeMe123!`), open any event's detail page and
click **Volunteers** to see who's registered, search by name/email, and remove a registration —
each action shows a confirmation prompt and a flash message on success.

**Authorization**: while logged in as the regular user, try navigating directly to
`/admin/events/<id>/volunteers` — you'll get a 403 page.

---

## Not Yet Implemented (by design, per this phase's scope)

Attendance Tracking, Donation Management, Certificate Generation, Reports. There is still no
approve/reject workflow or global cross-event registrations view — see Design Notes for why.
