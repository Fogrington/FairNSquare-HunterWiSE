// Test environment: a dedicated local database and a throwaway signing secret.
// Loaded before any application module, so config.ts and connection.ts see these values.
process.env.DB_HOST = process.env.TEST_DB_HOST ?? 'localhost'
process.env.DB_PORT = process.env.TEST_DB_PORT ?? '5432'
process.env.DB_NAME = process.env.TEST_DB_NAME ?? 'fairn2_test'
process.env.DB_USER = process.env.TEST_DB_USER ?? 'postgres'
process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD ?? ''
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long'
delete process.env.DATABASE_URL

// Silence expected server-side error logging during negative-path tests
jest.spyOn(console, 'log').mockImplementation(() => {})
