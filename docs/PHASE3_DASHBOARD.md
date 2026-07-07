# Phase 3 — Design System + Dashboard Module

Status: implemented and verified end-to-end against the running dev server and the seeded
database. Scope is the User Dashboard, Admin Dashboard, and — at your request, before the
dashboard build — a reusable design system meant to carry through every future module. No Event
Management, Volunteer Registration, Attendance, Donations, Certificates, or Reports.

---

## 1. Design System

Before the dashboard views were (re)built, the whole front-end was put on a shared foundation so
Event Management, Volunteer Management, Donations, Reports, Certificates, and the existing
Authentication pages all inherit the same look automatically, rather than each module inventing
its own styling.

### CSS architecture (`src/public/css/`)

One monolithic `style.css` was replaced with five focused files, each with a single job, all
loaded via `<link>` tags in the layouts (not `@import`, so the browser fetches them in parallel):

| File | Responsibility |
|---|---|
| `base.css` | Design tokens (CSS custom properties) + resets + base typography. Every color, spacing value, radius, shadow, and transition used anywhere else in the app is defined once here as a `--variable`. |
| `layout.css` | The app shell: collapsible sidebar, topbar, breadcrumb, responsive behavior. |
| `components.css` | The reusable component library: buttons, cards, badges, avatars, forms, alerts, tables. This is the part every future module should build from. |
| `dashboard.css` | Dashboard-specific compositions (stat grid, activity card grid, quick actions) built on top of `components.css`, not duplicating it. |
| `auth.css` | Public/unauthenticated page layout (home, login, register, error) — the simple centered-card look, distinct from the dashboard app shell. |

### Design tokens (in `base.css`)

- **Color palette**: a neutral slate scale for text/surfaces/borders, an indigo brand color
  (`--color-primary`) for interactive elements, and semantic colors (success/warning/danger/info),
  each with a "soft" tint variant for badges/alert backgrounds. The sidebar uses its own dark
  palette (`--sidebar-bg`, etc.) — a deliberate light-content/dark-sidebar split, the standard
  "premium admin dashboard" pattern.
- **Typography**: the system font stack (`system-ui, -apple-system, Segoe UI, Roboto, sans-serif`)
  — no external font request, no flash-of-unstyled-text, works offline.
- **Spacing scale**: `--space-1` through `--space-8` (4px base unit) instead of ad hoc `px`/`rem`
  values scattered through the CSS.
- **Radius scale**: `--radius-sm/md/lg/full` for consistently rounded corners across cards,
  buttons, inputs, and avatars.
- **Shadows**: `--shadow-sm/md/lg`, soft and subtle by design (per your "no unnecessary visual
  effects" instruction) — used for card elevation and the user-menu dropdown, not decoration.
- **Transitions**: `--transition-fast` (150ms) / `--transition-base` (200ms) — used for hover
  states and the sidebar collapse/mobile-drawer animation, nothing gratuitous.

### Component library (`components.css`)

`.btn` (+ `-primary`/`-secondary`/`-ghost`/`-danger`/`-sm`/`-block`), `.card` (+ `-hover` for the
lift-on-hover effect), `.badge` (+ soft/role/success/warning/danger variants), `.avatar` (+ `-lg`),
`.form-group`/`.form-label`/`.form-control`/`.form-hint`, `.alert` (+ danger/success/info), and
`.table`/`.table-responsive` — the last one isn't used by anything yet, but is ready for the first
module that needs a data table (Event Management, most likely).

### App shell (`layout.css` + `src/views/layouts/app.ejs`)

- **Collapsible sidebar**: dark, icon+label nav items, collapses to icon-only on desktop (state
  remembered via `localStorage`) and becomes an off-canvas drawer with a backdrop on
  tablet/mobile (<1024px).
- **Topbar**: sticky, contains the mobile menu button, the breadcrumb trail, and the user profile
  section on the right.
- **User profile section**: avatar (initials, generated server-side by `src/utils/format.js`'s
  `getInitials()`), name, role badge, and a click-to-open dropdown with account details + Log Out.
- **Breadcrumb**: driven by a `breadcrumbs` array each controller passes to the view (currently
  just `[{ label: 'Dashboard' }]` on both dashboards — will grow a level as sub-pages are added,
  e.g. `Dashboard > Events > Create`).
- **Sidebar nav content**: `src/config/navigation.js` defines the full intended nav per role
  (Dashboard, Events, Registrations, Donations, Certificates, Reports/Notifications, ...). Only
  "Dashboard" is a real link right now; every other entry renders disabled with a "Soon" badge —
  the same placeholder convention used for the dashboard cards, so the sidebar previews the whole
  app's shape honestly instead of either being empty or linking nowhere.

A second, simpler layout (`src/views/layouts/simple.ejs`) is used for public/unauthenticated pages
(home, login, register, error) — just a slim top bar (brand + Login/Register or Dashboard/Log Out)
and a centered card, no sidebar. `express-ejs-layouts`' default layout is `layouts/simple`;
dashboard routes opt into `layouts/app` explicitly via `{ layout: 'layouts/app' }`.

### Icons

Font Awesome (solid style) is used throughout — sidebar items, dashboard cards, stat cards, quick
actions, alerts, the user menu. It's **self-hosted**, not loaded from a CDN: only the two CSS
files and the one webfont actually used (`fontawesome.min.css` + `solid.min.css` +
`fa-solid-900.woff2`, ~195KB total) were copied from the `@fortawesome/fontawesome-free` npm
package into `src/public/vendor/fontawesome/` and served as static assets. This keeps the app fully
functional offline — important for a live FYP defense where you can't rely on venue Wi-Fi. The npm
package itself was uninstalled after copying; it was only ever a source for these two files, not a
runtime dependency.

### Vanilla JS (`src/public/js/main.js`)

Four small, independent behaviors, each a no-op if its elements aren't on the page (so the same
file works across every page without conditionals in the templates):
1. Sidebar collapse toggle (desktop), persisted via `localStorage`.
2. Mobile sidebar drawer open/close + backdrop click-to-close.
3. User menu dropdown open/close + click-outside-to-close.
4. Client-side time-of-day greeting (carried over from the original Phase 3 pass — the server
   can't know the visitor's timezone, the client can).

No animation libraries, no unnecessary motion — just the sidebar/drawer slide (functional, not
decorative) and simple color/shadow transitions on hover, per your instruction not to add effects
that reduce usability.

---

## 2. Dashboard Module (built on top of the design system above)

**Model** — `src/models/userModel.js` gained `countUsers()` (a single `COUNT(*)` query — the only
genuinely live statistic this phase produces, since it's backed by the already-implemented
Authentication module).

**Service** — `src/services/dashboardService.js`:
- `getUserDashboardCards()` — the six User Dashboard cards (Upcoming Events, My Event
  Registrations, My Volunteer Hours, My Donations, My Certificates, Notifications), each with a
  static `value: '—'`, `status: 'Coming soon'`, and an icon matching its sidebar counterpart.
- `getAdminStats()` — five stat entries. `totalUsers` is real; the other four
  (Events/Volunteers/Donations/Certificates) are placeholders (`value: '—'`, `isLive: false`).
- `getAdminQuickActions()` — five disabled quick-action definitions with icons (Create Event,
  Approve Registrations, Record Donation, Generate Certificate, View Reports).

**Controller** — `src/controllers/web/dashboardController.js`:
- `index` (`GET /dashboard`) — role-aware entry point; admins redirect to `/admin/dashboard`,
  everyone else gets their dashboard rendered here. Assembles `user`, `initials`, `navItems`
  (from `config/navigation.js`), `currentPath` (for sidebar active-state), and `breadcrumbs`.
- `adminDashboard` (`GET /admin/dashboard`) — same assembly, plus `stats` and `quickActions`.
  Access control is enforced by the route (`requireRole('admin')`), not this function.

**Routes** — `src/routes/web/dashboardRoutes.js`, unchanged in structure from the first pass: both
behind `verifyJwt`; `/admin/dashboard` additionally behind `requireRole('admin')`. No new
middleware — this module only consumes the existing Authentication/RBAC middleware, as instructed.

**Views**
- `src/views/pages/dashboard/index.ejs` — welcome heading, profile summary card, six placeholder
  cards in a responsive grid.
- `src/views/pages/admin/dashboard.ejs` — welcome heading, five stat cards, five disabled
  quick-action buttons.
- `src/views/partials/dashboard/statCard.ejs`, `placeholderCard.ejs` — the two reusable partials
  both dashboards render their cards from.

**Retired from Phase 2** (superseded by the real thing, as flagged when they were created): the
temporary `/profile` page and the temporary `GET /api/v1/admin/ping` diagnostic endpoint.

**New dependency**: `express-ejs-layouts` (dev-installed in the first Phase 3 pass, still used).
`@fortawesome/fontawesome-free` was installed and then uninstalled — only its static files were
kept (see above).

---

## 3. Design Notes

- **Why one `/dashboard` route that redirects, plus a separate `/admin/dashboard`**: the sidebar
  only ever needs one "Dashboard" link regardless of role, but `/admin/dashboard` still exists as a
  directly reachable, independently RBAC-gated URL — so "only admins may access the Admin
  Dashboard" is a real, testable route guard (a non-admin hitting it directly gets `403`), not just
  a UI convention.
- **Why Total Users is real but the other four stats aren't**: Users/Authentication is already
  implemented; Events/Volunteers/Donations/Certificates are not. Showing a live `3` next to four
  honest `—` placeholders is more accurate than either faking all five or quietly querying
  always-empty tables and calling it real data.
- **Why the sidebar previews modules that don't exist yet**: rather than a sparse one-link sidebar
  or dead links that 404, every future module gets a disabled, labeled, "Soon"-badged entry —
  consistent with the dashboard cards' own placeholder convention, and a more honest preview of the
  intended product than either extreme.
- **Why self-hosted Font Awesome instead of a CDN link**: an FYP defense often happens on venue
  Wi-Fi or offline; a CDN dependency for icons is an unnecessary failure point for something this
  small (~195KB self-hosted).

---

## 4. Test Results (this session)

All run against the live app and the live seeded database, after the redesign:

| # | Test | Result |
|---|---|---|
| 1 | `GET /` and all 5 CSS files + both Font Awesome CSS files + the webfont | All `200` |
| 2 | `GET /register` uses new component classes (`.card.auth-card`, `.form-control`, `.btn-primary.btn-block`) | Present |
| 3 | Log in as seeded user, `GET /dashboard` | `200`; sidebar, topbar, breadcrumb ("Dashboard"), avatar with correct initials ("AK") all present |
| 4 | Sidebar nav state | "Dashboard" link has `is-active`; the other 6 items are `is-disabled` (6 confirmed) |
| 5 | Dashboard card icons | Font Awesome classes present and correct per card |
| 6 | Regular user requests `GET /admin/dashboard` directly | `403`, rendered with the simple (no-sidebar) layout, not leaking the app shell |
| 7 | `GET /dashboard` with no session | `302 → /login` |
| 8 | Log in as seeded admin, `GET /dashboard` | `302 → /admin/dashboard` (role-redirect) |
| 9 | `GET /admin/dashboard` as admin | `200`; `Total Users` stat shows the live value `3`; quick-action icons present |
| 10 | Logout via a real cookie jar (simulating a browser) | Cookie cleared; subsequent `GET /dashboard` correctly `302 → /login` |
| 11 | 404 page | Renders with the new card/error styling |

Database confirmed unchanged after testing — still exactly the Phase 1 seed state (1 admin, 2
users, 3 categories); this session was login-only, no accounts created or modified.

---

## 5. How To Test This Yourself

```bash
npm run dev
```

**As a regular user**: log in at `/login` with `aisha.khan@communityconnect.local` /
`ChangeMe123!` (or `bilal.ahmed@communityconnect.local`, same password — see
`docs/PHASE1_DATABASE.md`). You'll land on `/dashboard`: sidebar on the left (try the collapse
button at the top of it, and reload the page — it remembers your preference), your profile
summary, and six "Coming soon" activity cards. Try visiting `/admin/dashboard` directly — 403.

**As the admin**: log in with `admin@communityconnect.local` / `ChangeMe123!`. `/dashboard` bounces
you to `/admin/dashboard`: the stats grid (Total Users is live) and five disabled quick-action
buttons.

**Navigation**: click your avatar/name in the top-right to open the user menu (account details +
Log Out); click outside it to close. On the sidebar, only "Dashboard" is a real link — everything
else is intentionally disabled with a "Soon" badge.

**Responsiveness**: resize the browser below ~1024px — the sidebar becomes an off-canvas drawer
opened via the hamburger button in the topbar, with a tap-outside-to-close backdrop. Below 640px
the content padding tightens and the topbar hides the user's name/role text (avatar still shown).

---

## Not Yet Implemented (by design, per this phase's scope)

Event Management, Volunteer Registration, Attendance Tracking, Donation Recording, Certificate
Generation, Notifications, Reports. Every sidebar entry and dashboard card/stat tied to one of
these remains a labeled placeholder until its own phase lands — at which point it should be built
using the component classes in `components.css` rather than new one-off styles, per your
consistency instruction.
