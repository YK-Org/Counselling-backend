const { execSync } = require("child_process");

// Applies migrations once per run rather than once per test file. Skipped
// entirely when no test database is configured, so a unit-only run needs no
// database and no Docker.
//
// Plain JavaScript on purpose: a TypeScript globalSetup has to go through
// ts-jest before Jest can call it, and that hangs here rather than failing.
module.exports = async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;

  try {
    execSync("npx prisma migrate deploy", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    });
  } catch (error) {
    // Fail loudly here rather than letting every suite fail with a confusing
    // "table does not exist".
    throw new Error(
      "Could not prepare the test database. Is TEST_DATABASE_URL reachable?\n" +
        ((error.stdout && error.stdout.toString()) || error.message)
    );
  }
};
