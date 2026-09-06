/** @type {import('ts-jest').JestConfigWithTSJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  globalSetup: "<rootDir>/tests/globalSetup.js",
  testMatch: ["**/*.test.ts"],
  // Integration tests share one database, so running files in parallel would
  // have them truncating tables underneath each other.
  maxWorkers: 1,
  // Migrations and a cold database make the first integration test slow.
  testTimeout: 30000,
  clearMocks: true,
  collectCoverageFrom: [
    "src/helpers/**/*.ts",
    "src/services/**/*.ts",
    "src/routes/**/*.ts",
    "src/middleware/**/*.ts",
  ],
};
