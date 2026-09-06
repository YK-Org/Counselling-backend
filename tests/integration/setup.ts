// Shared setup for tests that need a real database.
//
// These exercise authorisation, which is decided by joining a user to a couple
// — mocking Prisma would only test the mock. The cost is a Postgres instance;
// the benefit is that the rules are verified the way they actually run.
//
// Start one with:
//   docker run -d --name counselling-test -p 55432:5432 \
//     -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test \
//     postgres:16-alpine
//   export TEST_DATABASE_URL="postgresql://test:test@localhost:55432/test"
//
// Without TEST_DATABASE_URL the integration suites skip rather than fail, so
// `npm test` still passes for someone who only wants the unit tests.

const TEST_DB = process.env.TEST_DATABASE_URL;

// Must be set before anything imports the Prisma client or the app.
if (TEST_DB) {
  process.env.DATABASE_URL = TEST_DB;
  process.env.DIRECT_URL = TEST_DB;
}
process.env.TOKEN_SECRET = process.env.TOKEN_SECRET || "test-secret-not-real";
process.env.APP_URL = "http://localhost:8080";
// The suite makes far more requests from one address than a person would.
process.env.RATE_LIMIT_API_MAX = "100000";
process.env.RATE_LIMIT_AUTH_MAX = "100000";

// app.ts calls dotenv.config(), so without this a developer's own .env would
// decide how these tests behave — and dotenv does not overwrite a variable
// that is already set, so claiming them here wins. Empty means "unset" to the
// middleware, which is the fails-open default the tests below rely on.
process.env.FORM_SHARED_SECRET = "";
process.env.DEFAULT_PHONE_REGION = "GH";
process.env.INTAKE_FORM_PREFILL_URL = "";

export const hasDatabase = Boolean(TEST_DB);

// Skips the whole suite when no database is configured, rather than failing.
export const describeDb = hasDatabase ? describe : describe.skip;

// Imported lazily so that a run without a database never constructs a client.
/* eslint-disable @typescript-eslint/no-var-requires */
export const getPrisma = () => require("../../src/prisma/client").default;
export const getApp = () => require("../../src/app").default;

const TABLES = [
  "AuditLog",
  "QuestionnaireResponse",
  "Questionnaire",
  "Assignment",
  "CoupleLessonCompleted",
  "Partner",
  "Couple",
  "Lesson",
  "Form",
  "Resource",
  "User",
];

// Between tests rather than after, so a failure leaves the data behind to
// inspect. CASCADE handles the foreign keys without needing a delete order.
export async function resetDatabase() {
  const prisma = getPrisma();
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE;`
  );
}

export async function disconnect() {
  await getPrisma().$disconnect();
}

// --- fixtures ---------------------------------------------------------------

export const PASSWORD = "Str0ng!Pass";

export async function createUser(overrides: Record<string, any> = {}) {
  const bcrypt = require("bcrypt");
  const prisma = getPrisma();
  return prisma.user.create({
    data: {
      email: overrides.email || `user-${Math.random().toString(36).slice(2)}@test.local`,
      firstName: overrides.firstName || "Test",
      lastName: overrides.lastName || "User",
      password: await bcrypt.hash(overrides.password || PASSWORD, 10),
      role: overrides.role || "counsellor",
      status: overrides.status || "active",
      ...(overrides.id ? { id: overrides.id } : {}),
    },
  });
}

// Signs in through the real endpoint rather than minting a token directly, so
// every test also depends on login continuing to work.
export async function signIn(app: any, email: string, password = PASSWORD) {
  const request = require("supertest");
  const response = await request(app)
    .post("/api/v1/login")
    .send({ email, password });
  return response.body?.token as string | undefined;
}

export async function createCouple(overrides: Record<string, any> = {}) {
  const prisma = getPrisma();
  const couple = await prisma.couple.create({
    data: {
      referenceCode: overrides.referenceCode || null,
      counsellorId: overrides.counsellorId || null,
      counsellorAccepted: overrides.counsellorAccepted ?? null,
      completed: overrides.completed ?? false,
      ...(overrides.id ? { id: overrides.id } : {}),
    },
  });

  if (overrides.withPartners !== false) {
    await prisma.partner.create({
      data: {
        coupleId: couple.id,
        name: overrides.manName || "Test Man",
        gender: "male",
        phoneNumber: overrides.manPhone || null,
        formSubmittedAt: overrides.manFormIn === false ? null : new Date(),
      },
    });
    await prisma.partner.create({
      data: {
        coupleId: couple.id,
        name: overrides.womanName || "Test Woman",
        gender: "female",
        phoneNumber: overrides.womanPhone || null,
        formSubmittedAt: overrides.womanFormIn === false ? null : new Date(),
      },
    });
  }

  return couple;
}
