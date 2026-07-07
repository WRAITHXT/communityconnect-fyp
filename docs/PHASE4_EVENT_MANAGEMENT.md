# Phase 4 — Event Management Module

Status: implemented and verified end-to-end against the running dev server and the live
PostgreSQL database (full CRUD, RBAC, banner upload, search/filter all exercised with real HTTP
requests — not just written). Scope is exactly Event Management — no Volunteer Registration,
Attendance Tracking, Donation Management, Certificate Generation, or Reports.

---

## 1. Schema Change (before any code)

The approved Phase 1 schema didn't anticipate two things this phase's instructions explicitly
require, so a new migration was added (the original Phase 1 migration was left untouched — you
never edit a migration that's already run; you add a new one on top):

`database/migrations/1751500013_alter-events-add-registration-deadline-and-update-status.js`:

1. **Adds `registration_deadline timestamptz NOT NULL`** — a field the instructions list as one of
   the fields to "Set" for an event, with no existing column for it. Safe as `NOT NULL` with no
   default because the `events` table has never had any rows (Event Management is the first
   module to write to it).
2. **Narrows `events.status`** from the original Phase 1 enum
   (`draft`/`published`/`cancelled`/`completed`) to exactly `draft`/`published`/`closed`, per this
   phase's explicit instruction ("Event Status (Draft / Published / Closed)"). Same
   empty-table safety argument applies. A `CHECK (registration_deadline <= start_datetime)`
   constraint was added alongside it — defense in depth alongside the service-layer check below.

Verified by actually running `npm run migrate:up` against the live database (see Section 5).

---

## 2. What Was Built

**Models**
- `src/models/eventCategoryModel.js` — `listAll()`, used to populate the category `<select>` in
  the form and the filter dropdowns.
- `src/models/eventModel.js` — `list()` (search/category/status/date filters, plus a `publicOnly`
  flag that forces `status IN ('published','closed')` regardless of any other filter passed in),
  `findById()`, `create()`, `update()`, `updateStatus()`, `remove()`, `countAll()`,
  `countUpcomingPublished()`. Every read query joins in `category_name` and computes
  `remaining_slots = capacity - approved_registrations` — that computation is real today (it just
  always evaluates to `capacity`, since `event_registrations` has no rows until Volunteer
  Registration exists), not a placeholder that needs revisiting later.

**Service** — `src/services/eventService.js`: `createEvent`, `updateEvent`, `deleteEvent`,
`setEventStatus`, and an `EventError` class (mirrors `AuthError` from Phase 2 for architectural
consistency). Holds the business rules that don't fit a single form-field validation rule:
combining separate Date/Start Time/End Time fields into `start_datetime`/`end_datetime`, checking
the category actually exists, checking end is after start, checking the registration deadline
isn't after the event starts, and cleaning up the old banner file from disk when an event is
deleted or its banner is replaced (best-effort — a missing file never fails the request).

**Validators** — `src/validators/eventValidators.js`: per-field syntactic checks
(`express-validator`) for title/description/category/venue/date/time/capacity/status. Cross-field
rules live in the service (see above), not here — mirrors the two-layer pattern from Phase 2's
auth forms.

**Upload middleware** — `src/middlewares/upload.js`, implemented for real (was a placeholder since
Phase 0): `multer` disk storage into `src/public/uploads/events/`, whitelisting JPEG/PNG/WEBP by
MIME type, 2MB limit, server-generated UUID filenames (the client's filename/extension is never
trusted). Wrapped so multer's errors flow into the same graceful error-rendering path as
`express-validator`'s, instead of falling through to a generic 500.

**Storage helper** — `src/utils/storage.js`, implemented for real:
`getPublicUrl(key) => '/' + key`. Exposed to every EJS view as `getBannerUrl()` via `app.locals`
(see `src/app.js`) — swapping local disk for S3-compatible storage later means changing this one
function, not any view or controller.

**Controllers**
- `src/controllers/web/adminEventController.js` — `list`, `showCreateForm`, `create`, `view`,
  `showEditForm`, `update`, `remove`, `updateStatus`. A shared `renderForm()` helper avoids
  repeating the create/edit form's render options across its four call sites (initial display,
  validation failure, service error on create, service error on update).
- `src/controllers/web/eventController.js` — `browseEvents`, `viewEvent` (read-only, user-facing).
  Enforces "users never see draft events" at the model-query level (`publicOnly: true`, always),
  not just in the UI — even a manipulated `?status=draft` query string can't leak drafts (see
  Section 6, test #7 in Phase 4's own test log below).

**Routes**
- `src/routes/web/eventRoutes.js` — `GET /events`, `GET /events/:id`, behind `verifyJwt` only (any
  authenticated role can browse; this is deliberately not public/guest-accessible — see Design
  Notes).
- `src/routes/web/adminEventRoutes.js` — full CRUD + publish/unpublish, all behind
  `verifyJwt` + `requireRole('admin')` applied once via `router.use(...)` rather than repeated on
  every route.

**Views** — `pages/admin/events/{list,form,view}.ejs` (admin management table, shared create/edit
form, detail page with Edit/Delete buttons) and `pages/events/{list,view}.ejs` (card-grid browse
page, read-only detail page with a disabled "Register to Volunteer — Soon" button, consistent with
the placeholder convention already established for other unbuilt modules).

**Design system additions** (all in service of "reuse the design system," not one-off styling):
- `components.css` gained `.form-row`/`.form-actions` (multi-field form layout), `.banner-preview`
  / `.hero-image` (image preview treatments), `.table-actions` (action-button groups in tables),
  and `.filter-bar` (search/filter row) — all generic, meant for any future module's forms/tables.
- `dashboard.css` gained `.page-header-row`/`.page-header-actions` (title + action-button header
  pattern) — also generic.
- A new `events.css` holds only what's genuinely Event-specific: the browse-page card treatment
  (`.event-card`, `.event-card-banner`, etc.).
- `src/utils/viewHelpers.js` (new) — `getAppShellLocals(req)`, factoring out the
  user/initials/navItems/currentPath locals every app-shell page needs, so the growing number of
  Event Management views (and `dashboardController`, refactored to match) don't each repeat it.

**Sidebar/dashboard integration** — `src/config/navigation.js`'s "Upcoming Events" (user) and
"Manage Events" (admin) entries are no longer disabled placeholders; they now link to `/events`
and `/admin/events`. The User Dashboard's "Upcoming Events" card and the Admin Dashboard's "Total
Events" stat and "Create Event" quick action are now live/real, for the same reason "Total Users"
was real back in Phase 3 — the module backing them now exists.

**New dependency**: `multer`.

---

## 3. Design Notes

- **Why event browsing requires login rather than being public/guest-accessible**: the Phase 4
  instructions frame "Browse Published Events" under "User Features," and requiring `verifyJwt`
  lets these pages reuse the app-shell layout (sidebar/topbar) exactly as instructed ("reuse
  existing layouts, sidebar, navigation"). A fully public, guest-facing browse page would need a
  second UI treatment for the shell (no sidebar makes sense for a logged-out visitor) — deferred
  rather than guessed at.
- **Why "remaining slots" is a real query, not a placeholder**: it's a read against
  `event_registrations`, a table that already exists in the schema — computing
  `capacity - COUNT(approved)` doesn't require implementing any Volunteer Registration business
  logic (applying, approving, withdrawing). It correctly shows `capacity` today (zero
  registrations exist) and needs no further changes once that module lands.
- **Why `renderForm()` is one function instead of four inline render calls**: the create/edit form
  needs to be (re)rendered from four different places (initial GET, express-validator failure,
  service-level `EventError` on create, same on update) with the same shape of locals each time.
  Centralizing it is what "use reusable components wherever possible" means at the controller
  level, not just in the view layer.
- **Why "Closed" supersedes the Phase 1 blueprint's `cancelled`/`completed`**: explained in
  Section 1 — this phase's explicit instructions are the more recent, specific word on the status
  model, and the change was free (empty table, no data to reconcile).

---

## 4. Test Results (this session)

All run against the live app and the live seeded database, with real HTTP requests:

| # | Test | Result |
|---|---|---|
| 1 | Regular user requests any `/admin/events*` route (list, create form, POST create) | `403` on every one |
| 2 | Admin requests the same routes | `200` (after fixing a real bug found here — see below) |
| 3 | Both roles can reach `GET /events` (read-only browse) | `200` for both |
| 4 | Unauthenticated requests to `/admin/events` and `/events` | `302 → /login` |
| 5 | Create event with a real multipart banner upload (JPEG/PNG) | `302 → /admin/events/1`; DB row correct; file physically present in `src/public/uploads/events/` |
| 6 | View the created event | Correct title, venue, date, time, deadline, capacity, remaining slots (30), banner `<img>` present |
| 7 | Draft event: `GET /events` (user) and `GET /events/1` (user) | Not listed; direct detail access → `404` (not leaked) |
| 8 | Publish the event (`POST /admin/events/1/status`) | `302`; now appears in the user browse list and detail page (`200`) |
| 9 | Edit the event (new title/venue/capacity, no new banner) | Persisted correctly; original banner file **preserved**, not deleted |
| 10 | Create a second event (different category, published) | Succeeds |
| 11 | Admin search (`?search=cleanup`), category filter (`?categoryId=2`), status filter (`?status=draft`) | Each returns exactly the matching event(s), or "No events match your filters." |
| 12 | User search, category filter, date filter | Each correct |
| 13 | User manipulates `?status=draft` on the public browse route | Silently ignored (falls back to showing all public events) — confirms the `publicOnly` guard in the model can't be bypassed via query string |
| 14 | Missing required fields | `400`, specific per-field messages ("Title is required.", etc.) |
| 15 | End time before start time | `400`, "End time must be after the start time." |
| 16 | Registration deadline after event start | `400`, "Registration deadline must be on or before the event start date." |
| 17 | Invalid/nonexistent category ID | `400`, "Please select a valid category." |
| 18 | Banner upload: wrong file type (`.txt`) | `400`, "Only JPEG, PNG, or WEBP images are allowed." |
| 19 | Banner upload: file over 2MB | `400`, "Banner image must be smaller than 2MB." |
| 20 | Confirmed no orphaned rows were created by any of tests 14–19 | DB checked directly — only the two legitimately created events existed |
| 21 | Unpublish an event, then delete an event with a banner | `302` each; DB row gone; banner file physically removed from disk |
| 22 | Admin Dashboard after all the above | "Total Events" stat correctly live (reflected the current count at each step) |

**Bug found and fixed during this session**: form re-renders on validation/business-rule failure
were returning HTTP `200` instead of `400` (the `renderForm()` helper wasn't setting a status
code). Fixed by deriving the status from whether `errors.length > 0`, then re-verified.

Database was restored to the exact Phase 1 seed state (1 admin, 2 users, 3 categories, 0 events)
after testing — every event created during this session was deleted before wrapping up.

---

## 5. How To Test This Yourself

```bash
npm run migrate:up   # applies the new registration_deadline/status migration if not already run
npm run dev
```

**As the admin** (`admin@communityconnect.local` / `ChangeMe123!`): the sidebar's "Manage Events"
now works. Create an event (all fields required except the banner), attach a JPEG/PNG/WEBP under
2MB, save. You'll land on its detail page. Try editing it, try leaving the banner field empty on
edit (it keeps the existing banner), try publishing/unpublishing from the list page's icon buttons,
try deleting one (you'll get a native confirm dialog first).

**As a regular user** (`aisha.khan@communityconnect.local` / `ChangeMe123!`): the sidebar's
"Upcoming Events" now works. Browse the card grid, use the search/category/date/status filters,
click into a published event's detail page — note the disabled "Register to Volunteer — Soon"
button, and that there's no Edit/Delete anywhere on this read-only path. Try guessing a draft
event's URL directly (if the admin has one in draft) — you'll get a 404, not the event.

**Authorization**: while logged in as the user, try navigating directly to `/admin/events` or
`/admin/events/create` — you'll get a 403 page, not a redirect or a silent failure.

---

## Not Yet Implemented (by design, per this phase's scope)

Volunteer Registration, Attendance Tracking, Donation Management, Certificate Generation, Reports.
The "Register to Volunteer" button on the event detail page and the sidebar/dashboard entries for
these modules remain disabled placeholders until their own phases land.
