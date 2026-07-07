# Phase 9 — Reports & Analytics Module

Status: implemented and verified end-to-end against the running dev server and the live
PostgreSQL database — every stat, report, filter, export format, and chart was exercised with
real HTTP requests and a real (then cleaned-up) dataset spanning every prior module. Scope is
exactly Reports & Analytics — no deployment work, no new business features beyond what's needed
to report on the ones that already exist.

---

## 1. Schema Change

One new table (not a reshape — nothing prior owned this data):

`database/migrations/1751500017_create-certificate-verification-logs-table.js` creates
`certificate_verification_logs`:

| Column | Type | Why |
|---|---|---|
| `certificate_id` | `integer NULL`, FK → `certificates`, `ON DELETE SET NULL` | Which certificate a lookup resolved to — `NULL` when the ID/code pair didn't match anything |
| `certificate_number_attempted` | `varchar(50) NOT NULL` | What was actually typed, kept even on a not-found lookup, so the audit trail survives regardless of outcome |
| `result` | `varchar(10) NOT NULL`, `CHECK IN ('valid','invalid')` | The same binary result the public verification page already shows |
| `checked_at` | `timestamptz NOT NULL DEFAULT now()` | When |

This backs the Certificate Report's "verification statistics" requirement. The public
verification page (Phase 8) checked a certificate and showed Valid/Invalid but recorded nothing —
`certificateService.verifyCertificate` (Phase 8, modified here) now also calls
`verificationLogModel.create(...)` on every attempt, logging *after* computing the result so
logging can never change what the visitor sees. This is the one required touch to a completed
module ("modify only if required for report integration") — the verification page's own behavior
is unchanged; it just now also has something to report on.

---

## 2. What Was Built

### Small additions to existing models (each a one-function addition, not a reshape)

- `eventModel.countPublished()` — every published event regardless of date (the existing
  `countUpcomingPublished` is future-only, which isn't what "Published Events" as a platform stat
  means).
- `registrationModel.countAll()` — every registration record regardless of status, mirroring how
  `donationModel.countAll()` already counts every donation regardless of status rather than a
  distinct-people count.
- `attendanceModel.countAttended()` / `getTotalHoursAll()` — platform-wide versions of the
  existing per-user `getTotalHoursForUser`.
- `userModel.listByRole(role)` — populates the Volunteer Report's and Certificate Report's
  volunteer-picker filter dropdowns.

### New files

- **`src/models/verificationLogModel.js`** — `create(...)`, `getStats({dateFrom, dateTo})` (total
  attempts / valid / invalid, scoped only by date — see Design Notes).
- **`src/models/reportModel.js`** — every cross-cutting aggregate query for the four reports and
  five charts. Doesn't belong to any single entity's own model since each query joins across
  several tables purely for reporting, never for that entity's own CRUD. See Section 4 for why
  several of its queries are written differently from the simple dynamic-`WHERE` `list()`
  functions elsewhere in this codebase.
- **`src/services/reportService.js`** — the business layer: parses/validates untrusted
  query-string filters (a malformed date or id is dropped, never passed to a query), orchestrates
  the model calls, and defines each report's exportable column list (with optional per-column
  `format` functions used by both exporters).
- **`src/utils/csvExporter.js`** (filled in a Phase 0 placeholder) — hand-rolled RFC 4180 CSV
  escaping (`toCsv`) and a `sendCsv(res, filename, columns, rows)` response helper. No
  `json2csv`/`csv-writer` dependency — the same reasoning already used elsewhere in this app
  (`certificatePdfService`'s predecessor, the JWT/bcrypt code) of writing the small amount of
  logic directly instead of adding a package for something this size.
- **`src/utils/pdfGenerator.js`** (extended, not new — see Section 1 of the Phase 8 doc for its
  origin) — `streamTablePdf(res, {filename, title, subtitle, columns, rows})`, a generic
  landscape-A4 tabular report renderer shared by all four reports' PDF exports, since the shape
  is identical: title, optional filter subtitle, paginated table.
- **`src/controllers/web/adminReportController.js`** — `overview`, one controller function per
  report (`eventReport`, `volunteerReport`, `donationReport`, `certificateReport`), and 8 export
  handlers built from two small factories (`makeCsvExport`/`makePdfExport`) instead of eight
  near-identical functions.
- **`src/routes/web/adminReportRoutes.js`** — mounted at `/admin/reports` (not `/`) — the Phase 5
  routing lesson applied from the start, same as every admin router since.
- **Views** — `src/views/pages/reports/overview.ejs` (9 stat cards + 5 charts),
  `events.ejs`, `volunteers.ejs`, `donations.ejs`, `certificates.ejs` (each: a filter form, the
  report's own summary cards where relevant, and its data table with Export CSV/PDF buttons that
  carry the current filters through as a query string).
- **`src/public/css/reports.css`** — the chart grid layout on top of `components.css` (`.card`);
  Chart.js draws to its own canvas, this file only sizes/positions the cards holding it.
- **`src/public/js/reportsCharts.js`** — renders the 5 charts from a JSON data island embedded in
  `overview.ejs`; runs only on that page.
- **`src/public/vendor/chartjs/chart.umd.min.js`** — [Chart.js](https://www.chartjs.org/) v4,
  self-hosted the same way Font Awesome was in Phase 3: installed temporarily, its UMD build
  copied into `public/vendor/`, then uninstalled — it's a static asset, not a runtime dependency.

### Wiring into existing modules

- `config/navigation.js` — admin "Reports" sidebar entry is now live (`/admin/reports`).
- `services/dashboardService.js` — the "View Reports" admin quick action now links to
  `/admin/reports` instead of being disabled.
- `src/app.js` — `webAdminReportRoutes` mounted at `/admin/reports`.
- `src/utils/format.js` — gained a `formatDate` export (identical to the one already inlined as
  `app.locals.formatDate` in `app.js`), so `reportService`'s CSV/PDF column formatters can format
  a date the same way the EJS views already do, without duplicating the `Intl` options in two
  places. `app.js` now imports and reuses it instead of keeping its own copy.

---

## 3. Charts & Analytics

Five charts, all on the Overview page only (the four detail report pages have filters + tables +
export, per the brief's own separation of "Reports" from "Charts & Analytics"):

| Chart | Form | Why |
|---|---|---|
| Event Registrations Over Time | Line, single series | Trend over time — the standard form for "how is this changing" |
| Volunteer Hours by Month | Bar, single series | Magnitude per discrete monthly bucket |
| Donation Amounts by Type | Bar, single series | Magnitude across nominal categories (swapping the order of Monetary/Food/etc. wouldn't change meaning, so this is nominal, not ordinal — one hue, not one color per bar) |
| Attendance by Event (most recent 8) | Grouped bar, 2 series | Two genuinely distinct measures (Registered vs. Attended) per event — this is the one chart on the page that needs a legend |
| Certificates Generated Over Time | Line, single series | Trend over time |

The 3-month/6-month time buckets are zero-filled via `generate_series` (a month with zero
activity still appears as a `0`, rather than silently vanishing from the x-axis).

**Color**: this project has no existing categorical chart palette to reuse, so the reference
palette's validated categorical set was used directly (see the `dataviz` skill's
`references/palette.md`). Before shipping, it was run through the skill's validator against this
app's own card background (white, not the skill's default off-white demo surface):

```
node scripts/validate_palette.js "#2a78d6,#1baf7a,#eda100,#008300,#4a3aa7,#e34948,#e87ba4,#eb6834" --mode light --surface "#ffffff"
```

Result: fixed-hue-order, lightness band, and CVD separation all **PASS** (worst adjacent ΔE 24.2).
Contrast vs. surface **WARN**s on three slots (aqua 2.82:1, yellow 2.17:1, magenta 2.69:1) — legal
per the skill's own rule *only* with secondary encoding (visible labels or a table view). The one
chart that uses a WARN-band slot (aqua, as the "Attended" series in the grouped bar chart) ships
with both a legend (mandatory for 2 series regardless) *and* a small data table directly beneath
the chart repeating the same two numbers per event — the relief the skill requires, not a
decorative addition.

Every single-series chart uses only categorical slot 1 (blue, `#2a78d6`) — per the skill's "reach
for sequential/one-hue unless the job is specifically identity" rule, since there's only one
series to encode. Chrome (gridlines, ticks, axis text) uses this app's own `--color-border`/
`--color-text-muted` tokens rather than the skill's demo ink/gray, since the chart sits inside this
app's own `.card` component — substituting the app's own neutral tokens onto the skill's validated
hue slots is exactly the "swap for your brand" step the skill describes.

Mark specs followed: bars ≤24px thick with 4px rounded data-ends (`borderRadius: 4`,
`maxBarThickness: 24`), lines 2px with round joins and ≥8px markers (`pointRadius: 4`), one axis
only per chart (no dual-axis charts anywhere), hairline gridlines, and built-in Chart.js tooltips
(index-mode, so hovering anywhere on the x-position shows every series at that point).

**Verified with a real browser**, not just by inspecting markup: Playwright + a headless Chromium
were used to log in as the seeded admin, load `/admin/reports`, and screenshot the rendered page
(`console --errors`-equivalent check also confirmed no JS console/page errors). All 5 charts
rendered correctly with real data from this session's test dataset. Chart.js and Playwright itself
were both temporary — Chart.js's static build was copied into `public/vendor/` and the npm package
uninstalled (Section 2); Playwright was installed with `--no-save` purely to take the verification
screenshot and uninstalled again immediately after.

---

## 4. Design Notes

- **Why `reportModel.js`'s queries parameterize filters differently from `donationModel.list()`/
  `certificateModel.list()`**: those build a dynamic `WHERE` clause with a `conditions.push(...)`
  array, which works because those are simple single-table-plus-one-join queries. Several report
  queries need `LEFT JOIN`s with *conditional aggregates* (e.g. "this volunteer's hours, but only
  from registrations in this date range") — filtering that in a `WHERE` clause would silently drop
  a volunteer entirely if they had zero matching rows in the range, instead of showing zeroes. The
  fix is putting the optional filter in the `JOIN`'s own `ON` clause using a fixed
  `($n::type IS NULL OR column = $n)` pattern, which needed no dynamic string-building at all —
  simpler than the `conditions[]` pattern for this specific shape, not just different for its own
  sake.
- **Why the Volunteer Report's SQL looks like two separate pre-aggregated subqueries instead of
  one flat multi-join** (see Section 5, bug #2): joining `event_registrations`/`attendance` *and*
  `certificates` directly to `users` in one query fans out — a volunteer with 2 registrations and
  2 certificates produces 2×2 = 4 combined rows before aggregation, silently multiplying a summed
  measure like hours. Pre-aggregating each side down to one row per `user_id` first, then joining
  those single-row-per-user results to `users`, removes the fan-out entirely.
- **Why "Total Volunteer Registrations"/"Total Donations"/"Total Certificates Generated" all count
  every record regardless of status**: consistency. `donationModel.countAll()` already counted
  every donation regardless of status (completed/pending/cancelled) before this phase; the new
  platform-wide stats follow the same convention rather than introducing a different rule per
  metric. "Total Amount"/"Total Donation Amount" remain completed-only, since that's specifically
  a *money* total, not a record count — the same distinction Phase 7 already made.
- **Why "Certificates Generated" (Certificate Report stat) includes revoked certificates**: revoking
  doesn't erase the fact that a certificate was issued at some point — the same reasoning `total
  Certificates Generated` on the Overview page uses `certificateModel.countAll()`, which has never
  excluded revoked rows.
- **Why "verification statistics" is scoped only by date range, not by event/volunteer**: a
  verification attempt is anonymous and public by design (Phase 8) — there is no "which volunteer
  is the admin filtering for" dimension to apply beyond whatever certificate the lookup happened
  to resolve to (or didn't).
- **Filter applicability per report** (the brief lists Date Range / Event / Volunteer / Donation
  Type / Status as one combined list across all four reports, not simultaneously valid for all
  four): applied only where semantically real —
  - Event Report: Date Range, Event.
  - Volunteer Report: Date Range, Volunteer.
  - Donation Report: Date Range, Donation Type, Status. (Donations have no `event_id` — Phase 7's
    reshape dropped it — so "Event" doesn't apply here.)
  - Certificate Report: Date Range, Event, Volunteer, Status (Active/Revoked).
- **Why CSV export is hand-rolled instead of a dependency**: this size of RFC 4180 escaping (quote
  a field if it contains a comma/quote/newline, double up internal quotes) is a few lines and
  matches how this codebase has consistently preferred small direct logic over a package for
  something this contained (`pdfGenerator.js` reaches for `pdfkit` only because real PDF layout is
  genuinely involved, not for anything this size).
- **Why the PDF table export is landscape with per-row measured height, not a fixed row height**:
  caught during this session's own testing (Section 5, bug #3) — a fixed height overlapped rows
  whenever a cell wrapped to two lines in a narrow column. Landscape plus `doc.heightOfString()`
  per row fixes the root cause rather than just widening columns and hoping nothing wraps.

---

## 5. Bugs Found and Fixed This Session

Real, non-cosmetic bugs — each caught by actually exercising the feature with realistic data, not
by re-reading the code:

1. **Ambiguous `month` column reference** — the three "last 6 months, zero-filled" chart queries
   used `generate_series(...) AS month` for the outer series *and* `date_trunc(...) AS month` in
   the joined subquery, then referenced bare `month` in the `ON`/`ORDER BY` clauses. PostgreSQL
   couldn't tell which "month" was meant, and the Overview page 500'd immediately.
   **Fix**: alias the series explicitly as `AS m(month)` and qualify every reference as `m.month`.
2. **Volunteer Report hours inflated (16.00 instead of 8.00)** — a real join fan-out (see Design
   Notes) caused a volunteer's summed attendance hours to be multiplied by their certificate
   count. Caught by checking a specific volunteer's numbers against known test data, not by
   inspecting the query. **Fix**: restructured into two pre-aggregated subqueries (Section 4).
3. **PDF report export rows overlapping** — caught by actually opening a rendered PDF, not just
   checking its `Content-Type`/status code. A fixed 22px row height didn't account for text
   wrapping to two lines in narrow columns (long event titles, the "Attendance Rate (%)" header),
   so a wrapped row's second line visually collided with the next row. **Fix**: switched the
   export to landscape and measure each row's actual height via `doc.heightOfString()` before
   drawing it (Section 4).

---

## 6. Test Results (this session)

All run against the live app and the live database, using a temporary dataset (2 events, 3
registrations, 2 attendance records — 1 present/1 present/1 absent across the two events, 2
donations, 2 certificates — 1 later revoked, 3 verification attempts) created for this session and
fully deleted afterward:

| # | Test | Result |
|---|---|---|
| 1 | RBAC: regular user on every `/admin/reports*` route (overview, all 4 reports, CSV/PDF export) | `403` on all |
| 2 | RBAC: unauthenticated on `/admin/reports` | `302` → `/login` |
| 3 | Analytics overview: all 9 stats | Matched hand-computed expected values exactly |
| 4 | Overview charts: rendered in a real headless-Chromium browser, screenshotted, checked for console/page errors | All 5 charts rendered correctly, zero JS errors |
| 5 | Event Report: unfiltered and filtered by event id | Correct rows, correct attendance rate (50%/100%) and remaining capacity |
| 6 | Volunteer Report: unfiltered and filtered by volunteer id | Correct after the fan-out fix (8.00 hours, not 16.00) |
| 7 | Donation Report: totals, breakdown by type, summary by status, filtered by type/status | All matched the underlying data exactly |
| 8 | Certificate Report: generated/revoked counts, verification stats, filtered by status | 2 generated (including the revoked one), 1 revoked, 3 attempts (1 valid / 2 invalid) |
| 9 | Every filter: malformed date, malformed id, invalid enum value | Each silently ignored (fell back to "no filter"), never a raw driver error |
| 10 | CSV export: all 4 reports, including with a filter that matches nothing | Correct `Content-Type`/`Content-Disposition`, correct rows, header-only CSV when empty |
| 11 | PDF export: all 4 reports, including empty-result case | Valid PDFs each time; visually inspected two of them directly (Section 5, bug #3 found and fixed here) |
| 12 | Dashboard integration: "Reports" sidebar link, "View Reports" quick action | Both live and correctly linked |
| 13 | Verification logging: valid attempt, wrong-code attempt, attempt against a revoked certificate | All three logged with the correct `result` and `certificate_id` (`NULL` for the wrong-code case, matching "never reveal which half was wrong") |

Database confirmed unchanged after testing — every row created during this session (2 events, 3
registrations, 2 attendance records, 2 donations, 2 certificates, 3 verification log entries) was
deleted before wrapping up, restoring the exact Phase 1 baseline (3 seeded users, 3 categories,
everything else at 0).

---

## 7. How To Test This Yourself

```bash
npm run migrate:up   # applies the verification-logs migration if not already run
npm run dev
```

**As the admin** (`admin@communityconnect.local` / `ChangeMe123!`): click **Reports** in the
sidebar. The Overview page shows 9 live stats and 5 charts (all zero/empty on a fresh database —
create an event, register/attend a volunteer, record a donation, and generate a certificate to see
them populate). From there, use the four report buttons at the top to reach the Event / Volunteer
/ Donation / Certificate reports — try their filters, then **Export CSV** and **Export PDF** to
confirm both formats download correctly with the same filters applied.

**Authorization**: while logged in as a regular volunteer, try navigating directly to
`/admin/reports` — you'll get a 403 page.

---

## Not Yet Implemented

Deployment, and no additional business features beyond what Reports & Analytics itself required
(the certificate verification log table exists solely to back the Certificate Report's
verification statistics).
