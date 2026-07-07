# Phase 8 — Certificate Generation Module

Status: implemented and verified end-to-end against the running dev server and the live
PostgreSQL database — every rule (eligibility, duplicate prevention, regenerate, revoke,
verification, search/filter, PDF download, RBAC) was exercised with real HTTP requests. Scope is
exactly Certificate Generation — no Reports, no deployment work.

---

## 1. Schema Change

One migration reshapes the Phase 1 `certificates` table. That table has never been written to by
any prior phase (Certificate Generation is the first module to use it), so this is a safe,
zero-data-loss reshape — the same reasoning already applied to Phases 4 and 7.

`database/migrations/1751500016_reshape-certificates-for-certificate-generation.js`:

| Change | Before (Phase 1) | After (Phase 8) | Why |
|---|---|---|---|
| Dropped | `file_key` | — | Certificates are rendered to PDF **on demand** from the row's own data (see Section 2) rather than stored as a file on disk, so there's nothing for this column to point at |
| Added | — | `verification_code varchar(20) NOT NULL UNIQUE` | The code half of the two-piece verification pair (system requirement: every certificate must have a Verification Code) |
| Added | — | `total_hours numeric(6,2) NOT NULL` | A **frozen snapshot** of the volunteer's hours at issuance, so a later attendance edit can't silently change an already-issued certificate |
| Added | — | `status varchar(20) NOT NULL DEFAULT 'active'`, `CHECK (status IN ('active','revoked'))` | Backs the Revoke feature |
| Added | — | `generated_by`, `revoked_by` (both nullable FK → `users`, `ON DELETE SET NULL`) | Audit trail of which admin (re)generated or revoked a certificate |
| Added | — | `revoked_at timestamptz` | When it was revoked |
| Added | — | `updated_at` + the shared `set_updated_at` trigger | Consistent with every other table in the schema |
| Kept as-is | `certificate_number varchar(50) NOT NULL UNIQUE` | same | Doubles as the "Certificate ID" shown to volunteers and used on the verification page |
| Kept as-is | `UNIQUE(user_id, event_id)` | same | The database-level guarantee behind "prevent duplicate certificates for the same volunteer and event" |

Applied and verified against the live database (exact column/constraint listing confirmed via
`information_schema`/`pg_constraint`) before any application code was written.

---

## 2. What Was Built

**Model** — `src/models/certificateModel.js`: `create`, `reissue` (regenerate in place — see
Section 4), `revoke`, `findById`, `findByEventAndUser` (duplicate check), `findForVerification`
(matches both certificate ID and code in one query), `listForUser`, `listEligibleForEvent` (the
per-event generation roster — one query joining registrations + attendance + an optional existing
certificate), `list` (admin global search/filter), `countAll`, `countForUser`.

**Service** — `src/services/certificateService.js`: exports `CertificateError` and:
- `generateCertificate(registrationId, adminId)` — checks eligibility (registration approved +
  attendance `attended`), checks for an existing certificate (friendly duplicate message), then
  inserts a new row with a freshly generated Certificate ID and Verification Code. A random-code
  collision (astronomically unlikely, since both codes are drawn from a 33-character alphabet at
  length 6/10) is retried up to 5 times; a genuine duplicate-registration race is caught via the
  `UNIQUE(user_id, event_id)` constraint and surfaced as the same friendly message.
- `regenerateCertificate(certificateId, adminId)` — re-issues the **same row** (fresh verification
  code, fresh issue date, refreshed hours snapshot, and reactivates it if it had been revoked)
  rather than inserting a second one, re-checking eligibility against the current
  registration/attendance state.
- `revokeCertificate(certificateId, adminId)` — sets `status = 'revoked'`, refuses to revoke an
  already-revoked certificate.
- `verifyCertificate(certificateNumber, verificationCode)` — the public verification lookup; see
  Section 5.
- Both codes are generated from a 33-character alphabet that excludes `0`/`O` and `1`/`I`, so a
  hand-typed code from a printed certificate is never ambiguous.

**PDF rendering** — `src/utils/pdfGenerator.js` (this file existed since Phase 0 as a one-line
placeholder earmarked for exactly this phase — filled in now instead of adding a parallel file
elsewhere): renders a landscape A4 certificate
with [pdfkit](https://pdfkit.org/) directly to the HTTP response (`doc.pipe(res)`) — there is no
intermediate file on disk. Contains: a vector "CC" brand mark and "CommunityConnect" wordmark (no
external logo image exists in this project, so the mark is drawn with pdfkit's own vector
primitives — a filled circle + text — consistent with the rest of the app never using a raster
logo), the title "Certificate of Appreciation", the volunteer's name, the event name and date, the
frozen hours total, a footer with Certificate ID / Verification Code / Issue Date, and an
Authorized Signature line.

**Validators** — `src/validators/certificateValidators.js`: `verifyCertificateValidators` — both
fields on the public verification form are just required (the actual matching, including
case-insensitivity on the code, happens in the service).

**Controllers**
- `src/controllers/web/certificateController.js` — `myCertificates`, `view`, `download`.
  `view`/`download` are ownership-checked: a certificate is only shown/downloaded if
  `certificate.user_id === req.user.id`, otherwise a 404 (not 403), matching the pattern from
  Phase 7's donation detail view.
- `src/controllers/web/adminCertificateController.js` — `eventRoster` + `generate` (the per-event
  generation workflow), `list`, `view`, `download`, `regenerate`, `revoke` (the global management
  workflow). No ownership check — any admin can act on any certificate.
- `src/controllers/web/certificateVerifyController.js` — `showForm`, `verify`. Public, no
  authentication.

**Routes**
- `src/routes/web/certificateRoutes.js` — `GET /my-certificates`, `GET /certificates/:id`,
  `GET /certificates/:id/download`, all behind `verifyJwt` only.
- `src/routes/web/adminCertificateRoutes.js` — `GET /`, `GET /:id`, `GET /:id/download`,
  `POST /:id/regenerate`, `POST /:id/revoke`, mounted at `/admin/certificates` (not `/`) — applying
  the Phase 5 routing lesson from the start, same as Phase 7's `adminDonationRoutes`.
- `src/routes/web/certificateVerifyRoutes.js` — `GET`/`POST /verify-certificate`, deliberately
  **public** (no `verifyJwt` at all). See Section 3 for why its registration position in `app.js`
  matters.
- `src/routes/web/adminEventRoutes.js` (modified) — two lines added:
  `GET /:id/certificates` (the eligible-volunteer roster for that event) and
  `POST /:id/certificates/:registrationId/generate`, alongside the existing
  volunteers/attendance sub-routes for the same event.

**Views**
- `src/views/pages/certificates/my.ejs` — "My Certificates": table of everything the volunteer has
  earned, with View/Download actions.
- `src/views/pages/certificates/view.ejs` — certificate detail (donor-facing, ownership-checked).
- `src/views/pages/admin/certificates/list.ejs` — the global admin list: a Total Certificates stat
  card, search/filter bar, and the full table with View/Regenerate/Revoke actions.
- `src/views/pages/admin/certificates/view.ejs` — admin detail page with Download/Regenerate/Revoke
  actions (Revoke only shown while `active`).
- `src/views/pages/admin/events/certificates.ejs` — the per-event generation roster (mirrors
  `admin/events/attendance.ejs`'s shape): every eligible volunteer, a Generate button if no
  certificate exists yet, or a status badge + "View" link if one does.
- `src/views/pages/verifyCertificate.ejs` — the public verification form + Valid/Invalid result,
  using `layouts/simple` (the same public layout as login/register).
- `src/views/partials/certificateStatusBadge.ejs` (new) — the two-state badge described below.

**New dependency**: [`pdfkit`](https://www.npmjs.com/package/pdfkit) (`^0.x`) — a pure-JS PDF
generation library with no native/binary dependency, matching this project's offline-safe
principle (the same reason Font Awesome is self-hosted rather than loaded from a CDN).

**Dashboard/sidebar integration** (same established pattern as every prior phase): User
Dashboard's "My Certificates" card is now live (a count, linking to `/my-certificates`); Admin
Dashboard's "Total Certificates" stat is now live; the "Generate Certificate" admin quick action
was renamed **"Manage Certificates"** and now links to `/admin/certificates` — mirroring Phase 7's
"Manage Donations" decision, since certificates (like donations) have no standalone "create" form;
generation is always contextual to one event's eligible-volunteer roster. The user and admin
sidebar "Certificates" entries are now live. A "Verify Certificate" link was added to
`partials/simpleNav.ejs` (the nav used on public pages) so the verification page is discoverable
without an account.

---

## 3. A Routing Subtlety: Keeping the Verification Page Truly Public

Every existing `/`-mounted router in this app (`eventRoutes`, `registrationRoutes`,
`attendanceRoutes`, `donationRoutes`, and now `certificateRoutes`) applies `router.use(verifyJwt)`
with no path — meaning, per the Phase 5 lesson already documented in
`docs/PHASE5_VOLUNTEER_REGISTRATION.md`, that middleware runs for **every** request that reaches
that specific router instance, not just requests matching one of its own routes. In effect, the
entire app is login-gated except `/`, `/login`, `/register`, and (per-route) `/dashboard` and
`/admin/dashboard`.

`/verify-certificate` needs to be public — an employer or reference-checker verifying a
volunteer's certificate has no CommunityConnect account. If `webCertificateVerifyRoutes` were
registered in `app.js` *after* any blanket-`verifyJwt` router (e.g. after `webEventRoutes` or
`webAttendanceRoutes`), an unauthenticated visitor's request would be redirected to `/login` by
whichever blanket-verifyJwt router happens to be registered first — before ever reaching the
actual public route. This was caught during implementation (not left as a latent bug): `app.js`
now registers `webCertificateVerifyRoutes` immediately after `webAuthRoutes` and before every
other `/`-mounted router, so it behaves exactly like `/login`/`/register` — reachable regardless
of authentication state. Verified directly: `GET /verify-certificate` without any cookie returns
`200`, while `GET /my-certificates` without a cookie returns `302` to `/login`.

---

## 4. The Colored Status Badge

`partials/certificateStatusBadge.ejs` — two states only (unlike the three-state badges in earlier
phases), since a certificate's lifecycle is simpler:

| `certificateStatus` | Label | Class | Meaning |
|---|---|---|---|
| `active` | Active | `badge-success` (green) | Currently valid — will pass verification |
| `revoked` | Revoked | `badge-danger` (red) | No longer valid — will fail verification |

---

## 5. Design Notes

- **Why "Regenerate" re-issues the same row instead of creating a new one**: the
  `UNIQUE(user_id, event_id)` constraint means there can only ever be one certificate per
  volunteer per event, so "regenerate" is necessarily an update, not an insert. This also means
  regenerating a **revoked** certificate reactivates it (`status` reset to `'active'`,
  `revoked_at`/`revoked_by` cleared) — the natural way to "un-revoke" one if it was revoked in
  error, without a separate "un-revoke" action the instructions never asked for.
- **Why certificates have no PDF file stored on disk**: the PDF is fully derivable from the
  certificate's own row (volunteer name, event, hours, ID, code, issue date) at any time, so
  rendering it fresh on every download avoids ever needing to reconcile a stored file with a
  regenerated/revoked row — "certificates must remain available for download after generation" is
  satisfied by the underlying data always being available, not by a cached file.
- **Why eligibility is (registration approved + attendance marked Present) and nothing more**:
  this is exactly system requirement #1, checked identically in `generateCertificate` and
  `regenerateCertificate` (the latter re-checks in case the underlying attendance changed since
  the certificate was first issued).
- **Why the admin search is one free-text box (matches volunteer name/email, event title, or
  certificate ID) rather than three separate fields**, with Event and Issue Date as their own
  explicit filters: the same resolution used for Phase 7's donation search — the instructions list
  "Volunteer Name / Event / Certificate ID" as search facets and "Event / Issue Date" as filter
  facets, so a single text box covers the free-text-shaped search facets while the Event dropdown
  and date picker satisfy the Filter facets directly, without a redundant duplicate "Event" input.
- **Why certificate generation lives on a per-event roster page rather than the global list**:
  generating a certificate requires knowing a specific volunteer's specific event registration and
  attendance record — there is no meaningful "create" action without that context. This mirrors
  how attendance and volunteer-roster actions already work per-event
  (`/admin/events/:id/attendance`, `/admin/events/:id/volunteers`); `/admin/events/:id/certificates`
  follows the same shape. The global `/admin/certificates` list is for viewing, searching, and
  managing (regenerate/revoke) certificates that already exist — the same generate-vs-manage split
  Phase 7 used for donations.
- **Why `adminCertificateRoutes` was mounted at `/admin/certificates` from the first draft**: same
  Phase 5 lesson applied proactively, as in Phase 7 — a blanket `router.use(verifyJwt,
  requireRole('admin'))` must be mounted at a matching path prefix or it silently 403s unrelated
  routes registered afterward.

---

## 6. Test Results (this session)

All run against the live app and the live seeded database, using the two seeded volunteer accounts
(Aisha Khan, Bilal Ahmed) and the seeded admin, plus a temporary test event created and deleted
during this session:

| # | Test | Result |
|---|---|---|
| 1 | Public verification page reachable without any auth cookie | `200` |
| 2 | `/my-certificates` and `/admin/certificates` without auth | Both `302` → `/login` |
| 3 | Set up: register two volunteers for a test event, mark one Present (4.00 hrs), one Absent | Confirmed via DB |
| 4 | Admin per-event roster (`/admin/events/:id/certificates`) | Shows only the Present volunteer as eligible, with a Generate button; the Absent volunteer is correctly excluded |
| 5 | RBAC: regular user on the roster page and on Generate | Both `403` |
| 6 | Generate a certificate for the eligible (Present) volunteer | Success; DB row created with a unique Certificate ID, Verification Code, and `total_hours = 4.00` |
| 7 | Attempt to generate for the Absent volunteer | Rejected: "A certificate can only be generated for a volunteer marked Present." |
| 8 | Prevent Duplicate Certificate: generate again for the volunteer who already has one | Rejected: "...already been issued...Use Regenerate instead." |
| 9 | Volunteer's "My Certificates" page | Shows the certificate with an Active badge |
| 10 | Volunteer views their own certificate detail | `200` |
| 11 | Ownership: the other volunteer guesses the certificate's id | `404` (not leaked) |
| 12 | Download PDF (volunteer route) | `200`, `Content-Type: application/pdf`, valid single-page PDF confirmed by file signature |
| 13 | Ownership: the other volunteer tries to download the same certificate id | `404` |
| 14 | Download PDF (admin route) | `200`, same valid PDF |
| 15 | RBAC: regular user on the global admin list | `403` |
| 16 | Admin global list: Total Certificates stat | Matched live count |
| 17 | Search by volunteer name, then by event title, then by certificate ID | Each correctly returned the matching row |
| 18 | Search for a non-matching term | "No certificates match your filters." |
| 19 | Filter by event (matching, then non-matching) | Correct row set each time |
| 20 | Certificate Verification: correct ID + correct code | "Valid Certificate" |
| 21 | Invalid Verification: correct ID + wrong code; correct ID + case-different code (should still pass); non-existent ID; empty fields | Wrong code → Invalid; case-different → Valid (case-insensitive by design); non-existent → Invalid; empty fields → validation errors, no crash |
| 22 | Regenerate: verification code and issue date change, certificate ID stays the same | Confirmed via DB before/after |
| 23 | Verify with the **old** (pre-regenerate) code after regenerating | Correctly Invalid — stale codes don't verify |
| 24 | RBAC: regular user on Regenerate/Revoke | Both `403` |
| 25 | Revoke a certificate, then verify it | "Invalid Certificate" (revoked certificates never verify, even with the right code) |
| 26 | Revoke an already-revoked certificate | Rejected: "This certificate has already been revoked." |
| 27 | Regenerate a revoked certificate | Reactivates it (`status` back to `active`, `revoked_at`/`revoked_by` cleared) |
| 28 | Error handling: malformed/non-existent certificate ids, malformed registration ids, non-existent event id on the roster page | `404` or a graceful flash error — never a raw crash |
| 29 | Dashboard: "My Certificates" (user) and "Total Certificates" (admin), "Manage Certificates" quick action | All correctly reflected live state and linked correctly |

Database confirmed unchanged after testing — the certificate, attendance records, registrations,
and the temporary test event created during this session were all deleted before wrapping up,
restoring the exact Phase 1 baseline (0 certificates, 0 events, 0 registrations, 0 attendance, 0
donations, 3 seeded users, 3 categories).

---

## 7. How To Test This Yourself

```bash
npm run migrate:up   # applies the certificates reshape migration if not already run
npm run dev
```

**As the admin** (`admin@communityconnect.local` / `ChangeMe123!`): create an event, register a
volunteer, mark them Present in Attendance, then open the event and click **Certificates** — you'll
see them listed as eligible with a **Generate** button. Click it, then visit **Certificates** in
the sidebar to see the global list; try **Regenerate** and **Revoke**.

**As the volunteer** you just generated a certificate for: click **My Certificates** in the
sidebar, open the certificate, and click **Download PDF**.

**Verification**: without logging in, click **Verify Certificate** in the top nav (or visit
`/verify-certificate`), and enter the Certificate ID and Verification Code shown on the
certificate's detail page. Try revoking the certificate as the admin first, then verifying again —
it will report Invalid.

---

## Not Yet Implemented (by design, per this phase's scope)

Reports, deployment.
