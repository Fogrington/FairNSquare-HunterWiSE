/** Jest configuration for the FairN² backend test suite.
 *  Tests run in-process against a real PostgreSQL database (fairn2_test),
 *  rebuilt from src/db/schema.sql before every test file. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/env.ts'],
  maxWorkers: 1,               // files share one database, so run them serially
  testTimeout: 30000,
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts'],
  coverageReporters: ['text', 'text-summary', 'json-summary'],
}
