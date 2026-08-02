// Bootstraps the first head counsellor.
//
// Every other account is created through the invite flow (POST /api/v1/users),
// which itself requires an authenticated head counsellor — so exactly one
// account has to exist before the app is usable. That is this one.
//
// Run with: npx prisma db seed
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set to seed the first head counsellor"
    );
  }

  const user = await prisma.user.upsert({
    where: { email },
    // Deliberately empty: re-running the seed must never reset the password of
    // an account whose owner has since changed it.
    update: {},
    create: {
      email,
      firstName: process.env.SEED_ADMIN_FIRST_NAME || "Head",
      lastName: process.env.SEED_ADMIN_LAST_NAME || "Counsellor",
      password: await bcrypt.hash(password, 10),
      role: "headCounsellor",
      status: "active",
    },
  });

  console.log(`Head counsellor ready: ${user.email} (${user.id})`);
  console.log(
    "If this account was just created, sign in and change the password immediately."
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
