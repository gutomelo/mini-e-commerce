/**
 * Single source of truth for the storefront's Playwright e2e environment.
 *
 * Mirrors `apps/api/test/support/test-env.ts`'s strategy deliberately: the
 * suite drives a real browser against a real, locally-started NestJS API
 * instance and a real Next.js dev server, both pointed at the same dedicated
 * `mini_ecommerce_test` Postgres database the API's own e2e suite already
 * uses (see that file's doc comment for why a dedicated database beats
 * reusing the dev `mini_ecommerce` database). Reusing the same database name
 * — rather than inventing a second one — means both suites share one mental
 * model of "the test database" and neither can be run concurrently with the
 * other without risking cross-suite interference, which matches how they're
 * actually run today (sequentially, in the phase's Verification checklist).
 *
 * This suite's API instance runs on its own port (`TEST_API_PORT`) and its
 * own Redis logical DB index (`TEST_REDIS_DB_INDEX`), distinct from the
 * API e2e suite's own instance/index, purely as defense in depth: it means a
 * stray leftover process or cache entry from one suite can never bleed into
 * the other even if someone runs them back-to-back without waiting for full
 * teardown.
 *
 * As with the API suite, these values live in a plain `.ts` module rather
 * than a `.env.test` file because the repo's secrets-protection hook blocks
 * creating/editing any `.env*` file — and there is nothing secret here
 * anyway (fixed, local-only test credentials).
 */

export const TEST_DATABASE_NAME = 'mini_ecommerce_test';
export const TEST_DATABASE_URL = `postgresql://postgres:postgres@localhost:5433/${TEST_DATABASE_NAME}`;
export const TEST_MAINTENANCE_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5433/postgres';

/** Logical Redis DB index 2 — distinct from dev (0) and the API e2e suite (1). */
export const TEST_REDIS_DB_INDEX = 2;
export const TEST_REDIS_URL = `redis://localhost:6380/${TEST_REDIS_DB_INDEX}`;

export const TEST_JWT_ACCESS_SECRET = 'web-e2e-access-secret';
export const TEST_JWT_REFRESH_SECRET = 'web-e2e-refresh-secret';
export const TEST_JWT_ACCESS_TTL = '15m';
export const TEST_JWT_REFRESH_TTL = '7d';

export const TEST_ADMIN_EMAIL = 'admin@miniecommerce.dev';
export const TEST_ADMIN_PASSWORD = 'admin-change-me';

/**
 * The auth endpoints (`/auth/register|login|refresh|logout`) share a single
 * 10-req/min throttle bucket per IP in production (see
 * `apps/api/src/app.module.ts`). Every request in this suite comes from the
 * same loopback address, and a full run legitimately issues more than 10
 * auth calls across its scenarios (multiple registrations, logins, and a
 * dedicated cross-user isolation test), so the production limit would make
 * the suite flaky by design rather than by accident.
 *
 * `app.module.ts` reads this override (`AUTH_THROTTLE_LIMIT`, falling back
 * to the production default of 10 when unset) so this suite can raise the
 * limit without changing production/dev behavior or the API's own
 * `test:e2e` suite (which never sets this variable and so keeps exercising
 * the real limit of 10 in `throttling.e2e-spec.ts`).
 */
export const TEST_AUTH_THROTTLE_LIMIT = 1000;

export const TEST_API_PORT = 3011;
export const TEST_API_BASE_URL = `http://localhost:${TEST_API_PORT}`;

export const TEST_WEB_PORT = 3100;
export const TEST_WEB_BASE_URL = `http://localhost:${TEST_WEB_PORT}`;

/** Env vars passed to the spawned `apps/api` process (Playwright `webServer.env`). */
export const API_SERVER_ENV: Record<string, string> = {
  PORT: String(TEST_API_PORT),
  DATABASE_URL: TEST_DATABASE_URL,
  REDIS_URL: TEST_REDIS_URL,
  JWT_ACCESS_SECRET: TEST_JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: TEST_JWT_REFRESH_SECRET,
  JWT_ACCESS_TTL: TEST_JWT_ACCESS_TTL,
  JWT_REFRESH_TTL: TEST_JWT_REFRESH_TTL,
  ADMIN_EMAIL: TEST_ADMIN_EMAIL,
  ADMIN_PASSWORD: TEST_ADMIN_PASSWORD,
  AUTH_THROTTLE_LIMIT: String(TEST_AUTH_THROTTLE_LIMIT),
};

/** Env vars passed to the spawned `apps/web` dev server (Playwright `webServer.env`). */
export const WEB_SERVER_ENV: Record<string, string> = {
  PORT: String(TEST_WEB_PORT),
  API_BASE_URL: TEST_API_BASE_URL,
};
