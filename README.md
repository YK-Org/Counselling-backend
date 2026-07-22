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

4. Build and run:

   ```bash
   npm run build
   npm start
   ```

## Prisma

- Schema: `prisma/schema.prisma`
- Migrations: `prisma/migrations/`
- Inspect data: `npm run prisma:studio`

Deeply-nested partner history (education, profession, parents, `otherInfo`, …)
is stored in `jsonb` columns on the `Partner` table; frequently-queried fields
(name, phone, gender, date of birth) are promoted to real, indexed columns.
