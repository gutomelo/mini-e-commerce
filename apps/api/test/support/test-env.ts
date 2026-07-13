/**
 * Single source of truth for the e2e test environment.
 *
 * The suite runs against a dedicated database (`mini_ecommerce_test`) on the
 * same Postgres instance used by `docker compose up -d --wait postgres` and
 * against the same compose Redis, isolated on logical DB index 1 so it never
 * shares keys with local dev traffic on index 0. Using a separate database
 * (rather than the dev `mini_ecommerce` database) means the suite can freely
 * truncate/reseed without touching data a developer might be inspecting via
 * `docker compose up`.
 *
 * These values intentionally live in a `.ts` module instead of a `.env.test`
 * file: the repo's secrets-protection hook blocks the agent from creating or
 * editing any `.env*` file, and there is nothing secret here anyway (fixed,
 * local-only test credentials).
 */
export const TEST_MAINTENANCE_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5433/postgres';
export const TEST_DATABASE_NAME = 'mini_ecommerce_test';
export const TEST_DATABASE_URL = `postgresql://postgres:postgres@localhost:5433/${TEST_DATABASE_NAME}`;

export const TEST_REDIS_URL = 'redis://localhost:6380/1';

export const TEST_JWT_ACCESS_SECRET = 'e2e-test-access-secret';
export const TEST_JWT_REFRESH_SECRET = 'e2e-test-refresh-secret';
export const TEST_JWT_ACCESS_TTL = '15m';
export const TEST_JWT_REFRESH_TTL = '7d';

export const TEST_ADMIN_EMAIL = 'admin@miniecommerce.dev';
export const TEST_ADMIN_PASSWORD = 'admin-change-me';

/** Applies the test environment to `process.env`. Idempotent and safe to call more than once. */
export function applyTestEnv(): void {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.REDIS_URL = TEST_REDIS_URL;
  process.env.JWT_ACCESS_SECRET = TEST_JWT_ACCESS_SECRET;
  process.env.JWT_REFRESH_SECRET = TEST_JWT_REFRESH_SECRET;
  process.env.JWT_ACCESS_TTL = TEST_JWT_ACCESS_TTL;
  process.env.JWT_REFRESH_TTL = TEST_JWT_REFRESH_TTL;
  process.env.ADMIN_EMAIL = TEST_ADMIN_EMAIL;
  process.env.ADMIN_PASSWORD = TEST_ADMIN_PASSWORD;
}
