/**
 * Single source of truth for the admin Playwright e2e environment.
 *
 * This suite is the most infrastructurally involved of the three Playwright
 * suites in this repo, because `apps/admin`'s "stock lookup/correction"
 * scenario needs a *real*, running `apps/inventory` Go instance in addition
 * to the `apps/api`/`apps/admin` pair `apps/web`'s suite already needs.
 * `apps/api`'s `HttpInventoryClient` always wires the real inventory client
 * (the `EVENT_PUBLISHER_MODE` toggle added earlier in this phase only
 * selects `EventPublisher` adapters, never `InventoryClient`), so there is
 * no fake to swap in here the way `apps/web`'s suite fakes out QStash.
 *
 * Database strategy: this suite reuses `mini_ecommerce_test` — the exact
 * same dedicated Postgres database `apps/api`'s own e2e suite and
 * `apps/web`'s e2e suite already use (see their own `support/test-env.ts`
 * files) — rather than inventing a fourth database name. All three suites
 * already share one mental model of "the test database" and are run
 * sequentially in each phase's Verification checklist, never concurrently;
 * reusing the name keeps that model intact instead of adding a case to
 * remember. `apps/inventory` gets its own dedicated database,
 * `mini_ecommerce_inventory_test`, on the same Postgres instance — separate
 * because it is a genuinely different schema/service, not a suite-isolation
 * concern.
 *
 * Port/index strategy: every port and the Redis logical DB index below are
 * distinct from both `apps/web`'s suite (`TEST_API_PORT=3011`,
 * `TEST_WEB_PORT=3100`, Redis index 2) and `apps/api`'s own e2e suite
 * (Redis index 1) — defense in depth, so a stray leftover process or cache
 * entry from one suite can never bleed into another even run back-to-back
 * without full teardown:
 *
 *   - `TEST_API_PORT = 3013` (apps/web's suite uses 3011; 3012 is skipped
 *     as a buffer in case a fourth suite is ever added between them)
 *   - `TEST_INVENTORY_PORT = 8091` (dev/compose default is 8081; +10 puts
 *     this suite's instance clearly outside the normal dev port)
 *   - `TEST_ADMIN_PORT = 4300` (dev/compose default is a different port
 *     entirely — `ng serve` defaults to 4200 — 4300 keeps this suite's
 *     instance unambiguous from a developer's own `ng serve` left running)
 *   - Redis logical DB index `3` (dev is 0, the api e2e suite is 1, the web
 *     e2e suite is 2)
 *
 * As with the other two suites, these values live in a plain `.ts` module
 * rather than a `.env.test` file because the repo's secrets-protection hook
 * blocks creating/editing any `.env*` file — and there is nothing secret
 * here anyway (fixed, local-only test credentials).
 */

export const TEST_DATABASE_NAME = 'mini_ecommerce_test';
export const TEST_DATABASE_URL = `postgresql://postgres:postgres@localhost:5433/${TEST_DATABASE_NAME}`;
export const TEST_MAINTENANCE_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5433/postgres';

/** `apps/inventory`'s own dedicated test database — distinct schema/service, not a suite-isolation concern. */
export const TEST_INVENTORY_DATABASE_NAME = 'mini_ecommerce_inventory_test';
export const TEST_INVENTORY_DATABASE_URL = `postgresql://postgres:postgres@localhost:5433/${TEST_INVENTORY_DATABASE_NAME}`;

/** Logical Redis DB index 3 — distinct from dev (0), the API e2e suite (1), and the web e2e suite (2). */
export const TEST_REDIS_DB_INDEX = 3;
export const TEST_REDIS_URL = `redis://localhost:6380/${TEST_REDIS_DB_INDEX}`;

export const TEST_JWT_ACCESS_SECRET = 'admin-e2e-access-secret';
export const TEST_JWT_REFRESH_SECRET = 'admin-e2e-refresh-secret';
export const TEST_JWT_ACCESS_TTL = '15m';
export const TEST_JWT_REFRESH_TTL = '7d';

export const TEST_ADMIN_EMAIL = 'admin@miniecommerce.dev';
export const TEST_ADMIN_PASSWORD = 'admin-change-me';

/**
 * Shared secret between the spawned `apps/api` and `apps/inventory`
 * instances, matching the `INTERNAL_API_KEY` / `INVENTORY_INTERNAL_API_KEY`
 * pairing documented in `.env.example` and wired in `docker-compose.yml`.
 */
export const TEST_INTERNAL_API_KEY = 'admin-e2e-internal-api-key';

/**
 * Same rationale as `apps/web/e2e/support/test-env.ts`: this suite's
 * scenarios legitimately issue more than the production 10-req/min
 * per-IP auth throttle across ADMIN login, the rejected CUSTOMER login, and
 * the customer registered directly via the API for the order-detail
 * scenario's setup, so the limit is raised for this suite only.
 */
export const TEST_AUTH_THROTTLE_LIMIT = 1000;

export const TEST_API_PORT = 3013;
export const TEST_API_BASE_URL = `http://localhost:${TEST_API_PORT}`;

export const TEST_INVENTORY_PORT = 8091;
export const TEST_INVENTORY_BASE_URL = `http://localhost:${TEST_INVENTORY_PORT}`;

export const TEST_ADMIN_PORT = 4300;
export const TEST_ADMIN_BASE_URL = `http://localhost:${TEST_ADMIN_PORT}`;

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
  // apps/api's HttpInventoryClient always wires the real inventory client
  // (EVENT_PUBLISHER_MODE never affects it), so it must be pointed at this
  // suite's own real, spawned apps/inventory instance.
  INVENTORY_BASE_URL: TEST_INVENTORY_BASE_URL,
  INVENTORY_INTERNAL_API_KEY: TEST_INTERNAL_API_KEY,
  // EVENT_PUBLISHER_MODE is left at its default (fake) deliberately: this
  // suite never exercises the real QStash flow, matching the "no automated
  // test changes default behavior" rule from this phase's own spec.
};

/** Env vars passed to the spawned `apps/inventory` process (Playwright `webServer.env`). */
export const INVENTORY_SERVER_ENV: Record<string, string> = {
  PORT: String(TEST_INVENTORY_PORT),
  INVENTORY_DATABASE_URL: TEST_INVENTORY_DATABASE_URL,
  INTERNAL_API_KEY: TEST_INTERNAL_API_KEY,
  // No QSTASH_* vars: EVENT_PUBLISHER_MODE is left unset, so
  // apps/inventory's own default-to-fake wiring (see cmd/server/main.go's
  // newEventPublisher) keeps the in-memory publisher, and its QStash
  // webhook route is never exercised by this suite.
};

/**
 * Env vars passed to the spawned `apps/admin` dev server (Playwright
 * `webServer.env`). Empty today: the Angular CLI dev-server does not read a
 * `PORT` env var (unlike `next dev`), so the port is instead passed as a
 * `--port` CLI flag in `playwright.config.ts`'s `webServer` command. Kept
 * as a named export (rather than omitted) purely for structural symmetry
 * with `API_SERVER_ENV`/`INVENTORY_SERVER_ENV` and in case a future env var
 * is ever needed here.
 */
export const ADMIN_SERVER_ENV: Record<string, string> = {};
