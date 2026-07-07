# Phase 7 — Donation Management Module

Status: implemented and verified end-to-end against the running dev server and the live
PostgreSQL database — every rule (type-conditional amount requirement, ownership protection,
search/filter, statistics, CRUD, RBAC) was exercised with real HTTP requests. Scope is exactly
Donation Management — recording only, no payment gateway, no Certificate Generation, Reports, or
deployment work.

---

## 1. Schema Change

One migration reshapes the Phase 1 `donations` table. That table was designed then for a richer,
possibly-anonymous, possibly-event-linked, admin-recorded ledger with a payment method and
currency — none of which are part of this phase's explicit requirements. Since `donations` has
never been written to by any prior phase (Donation Management is the first module to use it), this
is a safe, zero-data-loss reshape — the same reasoning already applied to Phase 4's events-status
change.

`database/migrations/1751500015_reshape-donations-for-donation-management.js`:

| Change | Before (Phase 1) | After (Phase 7) | Why |
|---|---|---|---|
| Dropped | `event_id`, `currency`, `payment_method`, `is_anonymous`, `donor_name`, `recorded_by` | — | Not part of this phase's 4 required fields; donations are no longer optionally anonymous/event-linked/admin-recorded-on-behalf-of |
| Renamed | `notes` (nullable) | `description` (`NOT NULL`) | "Description" is one of the four fields every donation must have |
| Changed | `amount NOT NULL` | `amount` nullable | Only required "if monetary" (system requirement #3) |
| Changed | `donor_id` nullable, `ON DELETE SET NULL` | `donor_id NOT NULL`, `ON DELETE RESTRICT` | Every donation is now tied to the authenticated user who submitted it (system requirement #5); RESTRICT preserves history rather than orphaning it |
| Added | — | `donation_type varchar(20) NOT NULL` | Monetary / Food / Clothing / Medical Supplies / Other |
| Added | — | `status varchar(20) NOT NULL DEFAULT 'pending'` | Completed / Pending / Cancelled |
| Added | — | `updated_at` + the existing `set_updated_at` trigger (reused from Phase 1) | Consistent with `users`/`events` |
| Added constraint | — | `donations_amount_required_for_monetary_check`: `CHECK (donation_type != 'monetary' OR amount IS NOT NULL)` | Enforces "amount if monetary" at the database level too |

Applied and verified against the live database (exact column/constraint listing confirmed via
`information_schema`/`pg_constraint`) before any application code was written.

---

## 2. What Was Built

**Model** — `src/models/donationModel.js`: `create`, `findById`, `update`, `remove`, `listForUser`
(donor's own history, filterable by date/type), `list` (admin's full list, searchable by donor
name/email, filterable by type/date/status), `getTotalForUser`, `countAll`, `getAdminStats`,
`getSummaryByType`.

**Service** — `src/services/donationService.js`: `createDonation`, `updateDonation`,
`deleteDonation`, a `DonationError` class (mirrors `EventError`/`RegistrationError`/
`AttendanceError`), and the shared `DONATION_TYPE_LABELS` map used by every view. The key design
decision lives here:

- **`createDonation` (donor-facing) always forces `status = 'pending'`**, regardless of what's in
  the request body — a donor has no way to mark their own donation Completed. This models a
  self-reported donation as something an admin later verifies.
- **`updateDonation` (admin-facing) accepts a `status` field** and is the only path that can move
  a donation to Completed or Cancelled.
- Both share `parseCommonFields()`, which holds the one cross-field rule that doesn't fit a single
  per-field validator: amount is optional in general, but required and must be a positive number
  specifically when `donationType === 'monetary'`.

**Validators** — `src/validators/donationValidators.js`: `donationValidators` (type, description,
date, optional-but-positive-if-present amount) and `donationStatusValidator` (status — used only
on the admin edit route, since the donor's create form has no status field at all).

**Controllers**
- `src/controllers/web/donationController.js` — `showCreateForm`, `create`, `myDonations`,
  `viewDonation`. `viewDonation` enforces ownership: a donation is only shown if
  `donation.donor_id === req.user.id`, otherwise a 404 (not a 403, so a guessed id doesn't confirm
  a donation exists).
- `src/controllers/web/adminDonationController.js` — `list` (with stats + type summary),
  `showEditForm`, `update`, `remove`.

**Routes**
- `src/routes/web/donationRoutes.js` — `GET /my-donations`, `GET /donations/create`,
  `POST /donations`, `GET /donations/:id`, all behind `verifyJwt` only.
- `src/routes/web/adminDonationRoutes.js` — `GET /`, `GET /:id/edit`, `POST /:id/update`,
  `POST /:id/delete`, mounted at `/admin/donations` in `app.js` (not `/`) — applying the Phase 5
  routing lesson from the start this time, rather than discovering the bug during testing.

**Views**
- `src/views/pages/donations/form.ejs` — the donor's create form (no status field).
- `src/views/pages/donations/my.ejs` — "My Donations": total-amount summary card, date/type
  filters, history table.
- `src/views/pages/donations/view.ejs` — donation detail (donor-facing, ownership-checked).
- `src/views/pages/admin/donations/list.ejs` — 5 stat cards (Total/Completed/Pending/Cancelled/
  Total Amount Received), a summary-by-type table, a search/filter bar, and the full donations
  table with Edit/Delete actions.
- `src/views/pages/admin/donations/edit.ejs` — the admin correction form (includes status).
- `src/views/partials/donationStatusBadge.ejs` (new) — the three-state colored badge described
  below.

**Vanilla JS** (`src/public/js/main.js`, `initDonationTypeToggle`): toggles the `amount` field's
`required` attribute and hint text live as the donor changes the Donation Type dropdown — a
progressive-enhancement signal only; the server enforces the real rule regardless.

**Dashboard/sidebar integration** (same established pattern as every prior phase): User
Dashboard's "My Donations" card is now live (total amount donated, linking to `/my-donations`);
Admin Dashboard's "Total Donations" stat is now live (a record count, matching how every other
dashboard stat is a count); the "Record Donation" admin quick action was renamed **"Manage
Donations"** and now links to `/admin/donations`, since — as this phase's own feature list makes
clear — there is no admin "create a donation" action, only manage/edit/delete of donor-submitted
ones. The user and admin sidebar "Donations" entries are now live.

**New dependency**: none (reuses `express-validator`, already installed).

---

## 3. The Colored Status Badge

`partials/donationStatusBadge.ejs` — three states, reusing the exact same badge classes as
Phases 5 and 6's badges (per the instruction to reuse existing badge components):

| `donationStatus` | Label | Class | Meaning |
|---|---|---|---|
| `completed` | Completed | `badge-success` (green) | Admin has verified the donation was received |
| `pending` | Pending | `badge-warning` (orange) | Self-reported, not yet verified (the default) |
| `cancelled` | Cancelled | `badge-danger` (red) | Admin determined it didn't happen / was reversed |

---

## 4. Design Notes

- **Why donors can create and read but never edit/delete their own donations**: the instructions
  list "Edit donation records" and "Delete donation records" only under Administrator Features,
  not Donor Features. Combined with donations always starting `pending`, this reads as a
  deliberate verification workflow — the donor's role is to report, the admin's role is to confirm
  or correct.
- **Why "amount" is nullable rather than always present with a `0` default**: `NULL` unambiguously
  means "not applicable" for a Food/Clothing/Medical Supplies/Other donation, whereas `0` would be
  ambiguous (a genuinely free monetary donation of `$0`? a missing value?). The
  `donations_amount_required_for_monetary_check` constraint is what actually enforces the "if
  monetary" rule at the database layer.
- **Why "Total Amount Donated"/"Total Amount Received" only count `completed` donations**: pending
  is unconfirmed and cancelled didn't happen — summing them would overstate real contributions.
  This was deliberately tested (Section 5, tests #9–10) rather than assumed correct.
- **Why the admin search is one free-text box (matches name or email) rather than three separate
  "Donor Name"/"User"/"Donation Type" fields**: the instructions list these as three search facets,
  but "Donor Name" and "User" both resolve to the same donor account — a single box matching
  `users.name ILIKE` or `users.email ILIKE` covers both without a redundant second field or a
  "pick a user from a dropdown of everyone" control this app has no other precedent for.
  "Donation Type" remains its own explicit filter dropdown, satisfying that facet directly.
- **Why `adminDonationRoutes` was mounted at `/admin/donations` from the very first draft** (not
  discovered as a bug this time): Phase 5 already established that a blanket
  `router.use(verifyJwt, requireRole('admin'))` must be mounted at a matching path prefix, or it
  silently 403s unrelated routes registered afterward. This phase applied that lesson from the
  start rather than re-deriving it.

---

## 5. Test Results (this session)

All run against the live app and the live seeded database, using the two seeded volunteer/donor
accounts and the seeded admin:

| # | Test | Result |
|---|---|---|
| 1 | RBAC: regular user on `/admin/donations` | `403` |
| 2 | RBAC: admin on `/admin/donations` | `200` |
| 3 | Create a monetary donation (amount provided) | `302` success flash; DB row correct, `status='pending'` |
| 4 | Create a food donation (no amount) | Succeeds; `amount` correctly `NULL` |
| 5 | Create a clothing donation (different donor) | Succeeds |
| 6 | Create a monetary donation **without** an amount | Rejected: "Amount is required for monetary donations." |
| 7 | Missing description / missing date / invalid type / negative amount | Each rejected with its specific message; confirmed no orphaned rows from any failed attempt |
| 8 | "My Donations" history, filtered by type and by date | Each filter returned exactly the matching donation(s) (verified precisely via occurrence counts, since the filter dropdown itself always lists all 5 types) |
| 9 | "Total Amount Donated" before any donation is Completed | `0.00` |
| 10 | Admin marks a donation Completed via Edit; total recalculated | Correctly became `150.50` |
| 11 | Ownership: a donor views their own donation detail | `200` |
| 12 | Ownership: a donor tries to view another donor's donation by guessing its id | `404` (not leaked) |
| 13 | Admin search by donor name, then by email | Each returned exactly the matching donor's donation(s) |
| 14 | Admin filter by status | Returned exactly the matching donations |
| 15 | Admin statistics (Total/Completed/Pending/Cancelled/Total Amount Received) | Matched the live state at each step |
| 16 | Admin edit: invalid status value | Rejected: "Please select a valid status." |
| 17 | Admin edit: change status to Cancelled | Persisted correctly; red badge confirmed |
| 18 | Admin delete | Row removed from the database |
| 19 | Error handling: malformed/non-existent donation ids (view, edit, delete) | `404` or a graceful flash error — never a raw crash |
| 20 | RBAC: regular user attempting the admin edit/delete routes directly | `403` on both |
| 21 | Dashboard: "Total Donations" (admin) and "My Donations" (user) | Both correctly reflected the live state after every create/complete/cancel/delete |
| 22 | Summary by donation type | Count and completed-amount total correct per type |

Database confirmed unchanged after testing — every donation created during this session was
deleted before wrapping up, restoring the exact Phase 1 baseline (0 donations, 3 seeded users, 3
categories).

---

## 6. How To Test This Yourself

```bash
npm run migrate:up   # applies the donations reshape migration if not already run
npm run dev
```

**As a donor** (`aisha.khan@communityconnect.local` / `ChangeMe123!`): click **My Donations** in
the sidebar (now live), then **Record a Donation**. Try selecting "Monetary Donation" — the Amount
field becomes required (both visually and on the server). Try submitting without a description or
date. Once recorded, view it in your history — it shows a "Pending" badge; you cannot edit or
delete it.

**As the admin** (`admin@communityconnect.local` / `ChangeMe123!`): click **Donations** in the
sidebar. Search by the donor's name or email, filter by type/date/status, and try **Edit** on a
pending donation — change its status to Completed and watch the donor's total update. Try
**Delete** on a record — you'll get a confirmation prompt first.

**Authorization**: while logged in as the donor, try navigating directly to
`/admin/donations/<id>/edit` — you'll get a 403 page.

---

## Not Yet Implemented (by design, per this phase's scope)

Certificate Generation, Reports, deployment. No payment gateway of any kind was integrated — this
module only records that a donation happened, exactly as instructed.
