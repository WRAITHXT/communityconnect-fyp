# Deploying to Render

This app is a standard Express/EJS server with a PostgreSQL database — no
build step, no separate frontend service. Deploy it on Render as a single
**Web Service**.

## Service settings

| Setting | Value |
|---|---|
| Environment | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Health check path | `/` |

Render sets `PORT` automatically and this app already binds to
`process.env.PORT` (see `src/config/env.js` / `server.js`) — no changes
needed there.

## Required environment variables

Set these in the Render dashboard under the service's **Environment** tab.
None of them come from a committed `.env` file — see `.env.example` for the
local-dev equivalents.

| Variable | Notes |
|---|---|
| `NODE_ENV` | **Must be set to `production` explicitly** — Render does not set this automatically. Several production behaviors key off it: secure cookie flags (JWT + CSRF), the CSRF cookie's `__Host-` prefix, JSON log formatting, and the database SSL setting added below. Leaving it unset silently downgrades all of these without breaking anything outright, so it's easy to miss. |
| `DATABASE_URL` | Use the connection string from your Render Postgres instance (the "Internal Database URL" if the DB is on Render too — cheaper and lower-latency than the external one). |
| `JWT_SECRET` | 32+ random characters. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `CSRF_SECRET` | Same as above, a different value. |
| `JWT_EXPIRES_IN` | Optional, defaults to `2h`. |
| `LOG_LEVEL` | Optional, defaults to `info`. |

Render also sets `RENDER=true` on every instance automatically — the app
uses this to skip its local log-file transports there (see
**Logging** below). No action needed.

## Database

1. Provision a Render Postgres instance and copy its connection string into
   `DATABASE_URL` above.
2. Run migrations once, after the database exists and the web service's env
   vars are set: open the web service's **Shell** tab on Render and run
   `npm run migrate:up`. Do this once per deploy that introduces new
   migrations — it's not run automatically on every boot.
3. The connection pool (`src/config/db.js`) enables SSL automatically when
   `NODE_ENV=production` — this is required for most managed Postgres
   providers, including Render's. No further configuration needed.

## File uploads — known limitation

Event banner images are stored on local disk
(`src/public/uploads/events`, written by `src/middlewares/upload.js`) and
served back out via `express.static`.

**Render's filesystem is ephemeral per-instance.** Concretely:

- Every deploy and every restart wipes anything written to local disk —
  uploaded banners will disappear.
- If the service is ever scaled to more than one instance, each instance has
  its own disk, so a banner uploaded through one instance won't be visible
  to a request served by another.

This was already anticipated when the storage layer was built —
`src/utils/storage.js` centralizes "stored key → public URL" behind a single
`getPublicUrl()` function specifically so the storage backend can be swapped
later without touching any calling code. Two options, in order of effort:

1. **Render persistent Disk (stopgap, single instance only).** Attach a Disk
   to the service, mount it at the upload directory. Uploads survive
   restarts/redeploys as long as the service never scales past one
   instance. Does not fix the multi-instance case.
2. **Object storage (S3-compatible), the durable fix.** Point
   `src/utils/storage.js` and `src/middlewares/upload.js` at an S3-compatible
   bucket (AWS S3, Cloudflare R2, Backblaze B2, etc.) instead of local disk.
   Survives restarts, redeploys, and horizontal scaling. Out of scope for
   this review (would touch upload/storage business logic), but the
   existing abstraction was built to make this a contained change.

For this project's current scope (FYP submission, single Render instance),
option 1 is sufficient; this limitation should just be disclosed rather than
silently discovered after a redeploy wipes demo data.

## Logging

Winston (`src/utils/logger.js`) always logs to the console — Render's log
dashboard captures this directly, no configuration needed. In production it
additionally writes to `logs/error.log` and `logs/combined.log`, but this is
skipped on Render specifically (detected via the `RENDER` env var Render
sets automatically): those files would sit on the same ephemeral disk as
uploads, vanish on every restart, and never be visible anywhere Render's
dashboard already shows the same data via stdout. This only affects
Render — a traditional non-ephemeral host still gets the log files.

## Reverse proxy / rate limiting

Render terminates TLS at its edge and forwards requests over plain HTTP with
an `X-Forwarded-For` header. Express's `trust proxy` setting is now set to
`1` (`src/app.js`) — trusting exactly that one hop — so `req.ip` resolves to
the real client IP instead of Render's proxy address. This is required for
`express-rate-limit` (used on login/register/certificate-verification) to
work at all in this environment; without it, the library's own IP-spoofing
guard throws on every request behind a proxy that sets
`X-Forwarded-For`, which would 500 those routes in production.

## HTTPS, cookies, CSRF

Render serves every service over HTTPS by default (including automatic TLS
certs for the `onrender.com` subdomain or a custom domain). Combined with
`NODE_ENV=production`:

- The JWT and CSRF cookies both get `Secure` and `SameSite=Strict`.
- The CSRF cookie is additionally issued with the `__Host-` prefix, which
  requires exactly this (HTTPS + `Secure` + `Path=/` + no `Domain`
  attribute) — already satisfied.

No further action needed here beyond setting `NODE_ENV=production`.
