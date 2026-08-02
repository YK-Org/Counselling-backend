# Counselling App Backend

A backend system built with **Node.js**, **Express**, and **PostgreSQL**, designed to help counsellors manage their counsellees and enable head counsellors to oversee all counselling activities.

The app includes secure data management, Google Drive integration for file storage, and role-based access control for counsellors and head counsellors.

---

## Tech Stack

| Layer             | Technology                |
| ----------------- | ------------------------- |
| Backend Framework | Node.js + Express         |
| Database          | PostgreSQL (Prisma ORM)   |
| File Storage      | Google Drive API          |
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

## Prisma

- Schema: `prisma/schema.prisma`
- Migrations: `prisma/migrations/`
- Inspect data: `npm run prisma:studio`

Deeply-nested partner history (education, profession, parents, `otherInfo`, …)
is stored in `jsonb` columns on the `Partner` table; frequently-queried fields
(name, phone, gender, date of birth) are promoted to real, indexed columns.
