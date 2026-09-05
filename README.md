# Counselling App Backend

A backend system built with **Node.js**, **Express**, and **PostgreSQL**, designed to help counsellors manage their counsellees and enable head counsellors to oversee all counselling activities.

The app includes secure data management, Cloudflare R2 for file storage, and role-based access control for counsellors and head counsellors.

---

## Tech Stack

| Layer             | Technology                |
| ----------------- | ------------------------- |
| Backend Framework | Node.js + Express         |
| Database          | PostgreSQL (Prisma ORM)   |
| File Storage      | Cloudflare R2 (S3 API)    |
| Authentication    | JWT                       |

---

## Getting Started

1. Install dependencies (also generates the Prisma client):

   ```bash
   npm install
   ```

2. Create a `.env` file (see `.env.example`) and set at least:

   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/counselling
   TOKEN_SECRET=your-jwt-secret
   ```

3. Apply the database schema:

   ```bash
   # development (creates/updates local DB + generates client)
   npm run prisma:migrate

   # production (applies committed migrations only)
   npm run prisma:deploy
   ```

4. Create the first head counsellor. Set `SEED_ADMIN_EMAIL` and
   `SEED_ADMIN_PASSWORD` in `.env`, then:

   ```bash
   npm run prisma:seed
   ```

   The seed is idempotent — re-running it will not touch an existing account.
   Sign in and change the password immediately.

5. Build and run:

   ```bash
   npm run build
   npm start
   ```

## User accounts

Every account in this app is staff, so there is no public registration. Accounts
are created one of two ways:

- **The first head counsellor** — `npm run prisma:seed` (see above).
- **Everyone else** — `POST /api/v1/users`, restricted to head counsellors:

  ```bash
  curl -X POST http://localhost:3000/api/v1/users \
    -H 'Authorization: Bearer <head counsellor token>' \
    -H 'Content-Type: application/json' \
    -d '{"email":"jane@example.com","firstName":"Jane","lastName":"Doe","role":"counsellor"}'
  ```

  `role` is `counsellor` or `headCounsellor`. The new account is created as
  `awaitingConfirmation` with no usable password, and the invitee is emailed a
  link to choose one. Setting a password through that link activates the
  account. Invite links last 7 days and work exactly once.

## File storage

Files live in a Cloudflare R2 bucket, accessed with the S3-compatible API.

Setup:

1. Create a bucket in the Cloudflare dashboard under **R2**. Keep it private —
   nothing here should have public access.
2. Under **R2 > Manage API tokens**, create a token with **Object Read & Write**
   scoped to that bucket only.
3. Fill in `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and
   `R2_BUCKET` in `.env`.

Objects are keyed `<type>/<ulid>.<ext>` where type is one of `assignments`,
`lessons`, `letters`, `profile-pictures`, `resources`. Keys are opaque: the
original filename is stored in the database, never in the key, so a key cannot
be guessed from a name and a user-supplied name cannot influence the path.

Profile pictures are served as **short-lived signed URLs** (10 minutes) that the
browser loads directly from R2 — no image passes through this server. The
`/media` download endpoint streams from R2 instead, because a multi-file request
is zipped on the fly and no such object exists to sign.

An earlier version stored files in Google Drive. That code and its one-off
migration script have been removed; if a deployment still holds Drive file ids,
recover `scripts/migrate-drive-to-r2.ts` from git history (last present in
`132897d`) and run it before deploying.

## Prisma

- Schema: `prisma/schema.prisma`
- Migrations: `prisma/migrations/`
- Inspect data: `npm run prisma:studio`

Deeply-nested partner history (education, profession, parents, `otherInfo`, …)
is stored in `jsonb` columns on the `Partner` table; frequently-queried fields
(name, phone, gender, date of birth) are promoted to real, indexed columns.

---

## Deployment

### Settings that are easy to miss

| Variable | Why it matters |
| --- | --- |
| `FORM_SHARED_SECRET` | Until it is set, `/couples/details` and both questionnaire endpoints accept writes from **anyone** who finds the URL. A warning is logged on every such request. |
| `TRUST_PROXY` | Set to `1` behind any reverse proxy or managed host. Without it every request appears to come from the proxy, and the rate limiters throttle all users as though they were one client. |
| `CORS_ORIGINS` / `APP_URL` | Restricts which browser origins may call the API and open a socket. If neither is set, every origin is allowed. |
| `EMAIL` + `GOOGLE_APP_PASSWORD` | Invites and password resets are emailed. Without these, inviting a counsellor creates an account nobody can sign in to. |
| `TOKEN_SECRET` | Rotating it signs out every user immediately. Generate a long random value; never reuse the development one. |

Turning on the form secret has an order to it. The endpoints fail **open**, so
deploying this code cannot take a live Google Form offline — but that also
means the protection is off until you finish the sequence:

1. Add the header to the Form's Apps Script:
   `'X-Form-Secret': '<the value>'`
2. Deploy the Apps Script and submit one test response.
3. Only then set `FORM_SHARED_SECRET` on the server and restart.

Doing it the other way round rejects real submissions in between.

### Releasing

On the server, per release:

```bash
npm ci --omit=dev     # postinstall runs `prisma generate`
npm run build         # compiles TypeScript into build/
npm run start:prod    # `prisma migrate deploy`, then serves
```

`start:prod` applies committed migrations before listening. `migrate deploy` is
idempotent, so restarts and a second instance are both safe. Run it under a
process manager (systemd, pm2) so the app comes back after a crash or reboot —
`npm start` is for local use and rebuilds on every launch.

Node 22 is what this is developed against. Prisma's query engine needs OpenSSL
present on the host.

`GET /health` answers without authentication, for uptime checks and load
balancer probes.

### Frontend

The portal is a separate Vue SPA (`counselling-app`). Two things to know:

- `VUE_APP_BASE_URL` is inlined at **build** time, so it cannot be changed
  after the fact by setting an environment variable — a new API URL means a
  rebuild. Nothing secret may go in it; it ships inside the JavaScript.
- The router uses history mode, so the host must rewrite unknown paths to
  `index.html`, or every deep link 404s on reload. `public/_redirects` covers
  Netlify, Vercel and Cloudflare Pages; `nginx.conf` is the equivalent for
  serving `dist/` from nginx yourself.

Whatever origin the portal is served from must appear in the API's
`CORS_ORIGINS` (or be its `APP_URL`), or every request from it is blocked.
