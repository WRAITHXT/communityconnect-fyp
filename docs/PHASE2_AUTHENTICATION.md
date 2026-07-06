# Phase 2 — Authentication

Status: implemented and verified end-to-end against the live local PostgreSQL database and a
running dev server (not just written — every flow below was actually exercised with `curl` in
this session). Scope is exactly the Authentication module — no dashboards, events, volunteering,
attendance, donations, certificates, or reports.

---

## 1. What Was Built

**Model** — `src/models/userModel.js`: `findByEmail`, `findById`, `createUser`, and
`sanitizeUser` (strips `password_hash`/`token_version` before any user object reaches a view or
JSON response). Plain parameterized SQL via the `pg` pool from Phase 0/1 — no ORM.

**Service** — `src/services/authService.js`: `register()`, `login()`, `issueToken()`, and an
`AuthError` class carrying a `code` (`EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `ACCOUNT_SUSPENDED`) so
controllers can react without string-matching error messages. All business rules live here, not
in the controller or model.

**Controllers**
- `src/controllers/web/authController.js` — `showRegisterForm`, `register`, `showLoginForm`,
  `login`, `logout`, `profile` (renders EJS).
- `src/controllers/api/authController.js` — `adminPing` (returns JSON; see "Temporary test
  routes" below).

**Routes**
- `src/routes/web/authRoutes.js` — `GET/POST /register`, `GET/POST /login`, `POST /logout`,
  `GET /profile` (protected).
- `src/routes/api/authRoutes.js` — `GET /api/v1/admin/ping` (protected, admin-only).

**Middleware**
- `src/middlewares/verifyJwt.js` — `verifyJwt` (blocks the request if there's no valid, current
  session — redirects to `/login` for web routes, `401 JSON` for `/api` routes) and
  `attachCurrentUser` (soft version, used globally so `res.locals.currentUser` is always available
  to views without forcing every route to require login).
- `src/middlewares/requireRole.js` — `requireRole(...roles)`, used after `verifyJwt`.
- `src/middlewares/validate.js` — runs after an `express-validator` chain; re-renders the
  originating form with error messages on failure.

**Validators** — `src/validators/authValidators.js`: `registerValidators` (name, email, password
complexity, confirm-password match) and `loginValidators` (email format, password presence).

**Config/utils (implemented for real, replacing the Phase 0 placeholders)**
- `src/config/jwt.js` — secret, expiry, cookie name (`cc_token`), and cookie options (`httpOnly`,
  `secure` in production only, `sameSite: 'strict'`, 2-hour `maxAge`).
- `src/utils/tokenService.js` — `signAccessToken` / `verifyAccessToken` wrapping `jsonwebtoken`.

**Views**
- `src/views/pages/auth/register.ejs`, `login.ejs` — forms with inline validation error display.
- `src/views/pages/auth/profile.ejs` — minimal authenticated page (name/email/role + logout
  button), explicitly a temporary stand-in for the real User/Admin Dashboard modules.
- `src/views/partials/header.ejs` — now shows Login/Register or Profile/Logout depending on
  `res.locals.currentUser`, sitewide.
- `src/public/css/style.css` — styling for the nav and auth forms.

**New dependencies**: `bcrypt` (already present from Phase 1), `jsonwebtoken`, `cookie-parser`,
`express-validator`.

### Temporary test routes (not features)

`GET /profile` and `GET /api/v1/admin/ping` exist solely to prove the middleware works end-to-end,
as explicitly required by this phase's testing instructions. They are intentionally bare (no
dashboard functionality) and are commented in the code as being replaced by the real User
Dashboard and Admin Dashboard modules later.

---

## 2. How Authentication Works Here

1. **Register** (`POST /register`) → validated → `authService.register()` hashes the password with
   bcrypt (10 salt rounds) and inserts a `role = 'user'` row (no self-service admin signup) →
   immediately logs the user in (same as login, below).
2. **Login** (`POST /login`) → validated → `authService.login()` looks up the user, compares the
   password with `bcrypt.compare`, and rejects with the *same* "Invalid email or password" message
   whether the email doesn't exist or the password is wrong (prevents account enumeration via the
   login form). A suspended account gets a distinct "This account has been suspended" message —
   only shown after the password already matched, so it doesn't leak account existence to a guesser.
3. **Token issuance** → `authService.issueToken()` signs a JWT (`{ sub, role, tokenVersion }`, 2h
   expiry) and the controller sets it as an `httpOnly`, `sameSite=strict` cookie (`secure` in
   production). No token is ever exposed to client-side JS.
4. **Every request** → `attachCurrentUser` (global) decodes the cookie if present and attaches
   `req.user` / `res.locals.currentUser`, but never blocks the request.
5. **Protected routes** → `verifyJwt` does the same decode, but additionally re-checks the *live*
   database row: rejects if the user was deleted, is `suspended`, or if `token_version` in the
   token no longer matches the current value in the `users` table. That last check is what makes
   "suspend this user" or "log out everywhere" instantly invalidate already-issued tokens, without
   a server-side session store.
6. **Role-gated routes** → `requireRole('admin')` runs after `verifyJwt` and checks `req.user.role`.
7. **Logout** (`POST /logout`) → clears the cookie and redirects to `/login`. (Does not bump
   `token_version` — that's reserved for the heavier "log out of all devices"/suspension case; a
   normal logout only needs to drop the one cookie in the browser that's logging out.)

---

## 3. Test Results (this session)

All of the following were run against the live app and a live PostgreSQL database, using `curl`:

| # | Test | Result |
|---|---|---|
| 1 | `GET /register` renders the form | `200` |
| 2 | `POST /register` with valid data | `302 → /profile`, `Set-Cookie: cc_token=...; HttpOnly; SameSite=Strict; Max-Age=7200` |
| 3 | `GET /profile` with that cookie | Shows correct name/email/role |
| 4 | Register again with the same email | `409`, "An account with this email already exists." |
| 5 | Register with a weak password (`abc`) | `400`, lists exactly which rules failed (length, uppercase, number) |
| 6 | Register with mismatched confirm-password | `400`, "Passwords do not match." |
| 7 | Login with wrong password | `401`, "Invalid email or password." |
| 8 | Login with an email that doesn't exist | `401`, **same** message as #7 (no enumeration) |
| 9 | Login with correct credentials | `302 → /profile`, fresh cookie set |
| 10 | Logout | `Set-Cookie: cc_token=; Expires=1970...` (cleared), `302 → /login` |
| 11 | `GET /profile` with no cookie | `302 → /login` (not a raw crash/500) |
| 12 | Regular user hits `GET /api/v1/admin/ping` | `403` |
| 13 | No cookie at all hits the same admin endpoint | `401` JSON: `{"error":{"message":"Authentication required."}}` |
| 14 | Seeded admin logs in, hits the same endpoint | `200` JSON with sanitized user info (`password_hash` absent) |
| 15 | Tampered JWT (signature byte flipped) | `401` |
| 16 | Malformed JWT (`not.a.jwt`) | `401` |
| 17 | Expired JWT (signed with `-10s` expiry) | `401` |
| 18 | Bump admin's `token_version` in the DB directly, reuse the old (still unexpired, signature-valid) cookie | `401` — proves revocation works without touching the token itself |
| 19 | Admin logs in again after the bump | `200` — new token carries the new `token_version` |
| 20 | Suspend a user directly in the DB | Login now fails with "This account has been suspended."; an existing valid cookie for that user is also rejected on the next request |

Decoded a real issued JWT to confirm structure: `{"sub":1,"role":"admin","tokenVersion":0,"iat":...,"exp":...}`, signed `HS256`, `exp - iat = 7200` seconds (exactly 2 hours, per the locked blueprint decision).

After testing, the database was cleaned back to exactly the Phase 1 seed state (1 admin, 2 users,
3 categories) — all accounts created or modified during this test pass were removed/reset.

---

## 4. How To Test This Yourself

### Setup
```bash
npm install       # picks up bcrypt, jsonwebtoken, cookie-parser, express-validator
npm run dev
```
Make sure `DATABASE_URL` in `.env` points at the migrated + seeded database from Phase 1.

### In a browser
1. Visit `http://localhost:3000/register`, create an account. You'll land on `/profile` showing
   your name/email/role, and the header nav will switch to "Profile (user)" / "Log Out".
2. Click **Log Out** — you're sent to `/login` and the nav reverts to Login/Register.
3. Log back in with the same credentials at `/login`.
4. Try registering a second time with the same email — you'll see the "already exists" error
   without losing your typed name/email.
5. Try a weak password — you'll see exactly which rule(s) failed.
6. Log in as the seeded admin (`admin@communityconnect.local` / `ChangeMe123!` — see
   `docs/PHASE1_DATABASE.md`) and visit `http://localhost:3000/api/v1/admin/ping` — you'll get a
   JSON confirmation. Log in as a regular seeded user (`aisha.khan@communityconnect.local` /
   `ChangeMe123!`) and visit the same URL — you'll get a 403 page.

### From the command line (reproduces the table above)
```bash
# Register + capture the session cookie
curl -i -c cookies.txt -X POST http://localhost:3000/register \
  -d "name=Your Name" -d "email=you@example.com" \
  -d "password=Passw0rd!" -d "confirmPassword=Passw0rd!"

# Access the protected profile page with that cookie
curl -b cookies.txt http://localhost:3000/profile

# Log out (clears the cookie)
curl -i -b cookies.txt -X POST http://localhost:3000/logout

# Confirm the protected route now redirects
curl -i http://localhost:3000/profile   # -> 302 to /login

# RBAC: log in as the seeded admin and hit the admin-only JSON endpoint
curl -c admin.txt -X POST http://localhost:3000/login \
  -d "email=admin@communityconnect.local" -d "password=ChangeMe123!"
curl -b admin.txt http://localhost:3000/api/v1/admin/ping   # -> 200 JSON

# RBAC: same endpoint with a non-admin session
curl -c user.txt -X POST http://localhost:3000/login \
  -d "email=aisha.khan@communityconnect.local" -d "password=ChangeMe123!"
curl -b user.txt http://localhost:3000/api/v1/admin/ping    # -> 403
```

### Verifying revocation (optional, requires DB access)
```sql
-- Forces every previously-issued token for this user to be rejected on next use:
UPDATE users SET token_version = token_version + 1 WHERE email = 'aisha.khan@communityconnect.local';

-- Immediately blocks login and invalidates any existing cookie for this user:
UPDATE users SET status = 'suspended' WHERE email = 'aisha.khan@communityconnect.local';
```
After either statement, a previously-working cookie for that user will start getting redirected to
`/login` (web) or `401` (API) on the very next request — no server restart needed, since
`verifyJwt` re-checks the database on every request rather than trusting the token alone.

---

## 5. Secure Error Handling Notes

- Login never reveals whether the failure was a bad email or a bad password (same generic
  message either way).
- Registration/login forms never echo the submitted password back into the re-rendered form.
- The centralized `errorHandler` (Phase 0) still catches anything unexpected and logs it via
  Winston without leaking a stack trace to the client — `AuthError`s are caught explicitly in the
  controller before that point, so only genuinely unexpected failures reach it.
- Raw Postgres errors (e.g. a unique-violation race on registration) are translated to a clean
  `AuthError` in the service layer rather than surfacing a database error to the user.
- `sanitizeUser()` is the only way a user record leaves the model layer toward a view/response —
  `password_hash` and `token_version` never appear in `/profile` or `/api/v1/admin/ping` output
  (confirmed in test #14 above).

---

## Not Yet Implemented (by design, per this phase's scope)

User Dashboard, Admin Dashboard, Event Management, Volunteer Registration, Attendance Tracking,
Donation Recording, Certificate Generation, Notifications, Reports. `/profile` and
`/api/v1/admin/ping` are temporary verification routes only, not these features.
