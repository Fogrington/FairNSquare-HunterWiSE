# FairN² backend test suite

Copy these files over the repo root (same paths). Changed: `fairnsquare-backend/src/index.ts`
(only listens when run directly), `package.json` (+ jest, ts-jest, supertest, test scripts).
New: `jest.config.js`, `tests/`, `.github/workflows/backend-tests.yml`.

## Run locally
1. Create an empty database: `createdb -U postgres fairn2_test`
   (tests drop and rebuild every table from `src/db/schema.sql` — never point them at a real DB)
2. `cd fairnsquare-backend && npm install`
3. `npm test` or `npm run test:coverage`
   Override connection with TEST_DB_HOST / TEST_DB_PORT / TEST_DB_NAME / TEST_DB_USER / TEST_DB_PASSWORD.

Result on 29 Oct 2026: 81/81 passing, 82.1% statement coverage. CI runs the same suite on every push
that touches the backend.
