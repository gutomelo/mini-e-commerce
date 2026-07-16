import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

import {
  ADMIN_SERVER_ENV,
  API_SERVER_ENV,
  INVENTORY_SERVER_ENV,
  TEST_ADMIN_BASE_URL,
  TEST_ADMIN_PORT,
  TEST_API_BASE_URL,
  TEST_INVENTORY_BASE_URL,
} from './e2e/support/test-env';

const API_ROOT = path.resolve(__dirname, '../api');
const INVENTORY_ROOT = path.resolve(__dirname, '../inventory');

/**
 * Runs the full database/seed bootstrap (see `e2e/global-setup.ts`)
 * synchronously, at module-evaluation time, *before* `defineConfig` below
 * is even constructed.
 *
 * This is not Playwright's usual `globalSetup:` config field — deliberately
 * so. Playwright 1.61's own task runner
 * (`playwright/lib/runner/index.js`, `createGlobalSetupTasks`) builds its
 * setup sequence as
 * `[removeOutputDirs, ...pluginSetupTasks, ...globalTeardowns, ...globalSetups]`.
 * The `webServer` array is implemented internally as a plugin, so its
 * processes are started as part of `pluginSetupTasks` — which runs *before*
 * any user-supplied `globalSetup` file. In other words, "global setup runs
 * before every `webServer` process starts" does not hold in this Playwright
 * version: a `globalSetup:`-registered file actually runs *after* every
 * `webServer` process has already been spawned and passed its health check.
 *
 * That ordering is harmless for `apps/api` and `apps/admin` here (neither
 * eagerly touches a database that must already exist just to pass its
 * health check), but it is fatal for `apps/inventory`: its `main.go` calls
 * `db.PingContext` synchronously at boot, before it ever serves `/health`,
 * so it exits immediately if `mini_ecommerce_inventory_test` does not exist
 * yet. Since this suite is the only thing that ever creates that database,
 * there is no other suite's leftover state to fall back on the way
 * `apps/web`'s/`apps/api`'s suites can for `mini_ecommerce_test`.
 *
 * The fix: perform the entire bootstrap as a blocking `execFileSync` call
 * here, at the top of this config file's module body. Playwright must fully
 * evaluate this module (including this call) before it can read
 * `config.webServer` off the object `defineConfig` returns, which guarantees
 * every database this suite needs already exists by the time any
 * `webServer` process is spawned — no reliance on Playwright's internal
 * task ordering required.
 */
execFileSync('node_modules/.bin/tsx', ['e2e/run-global-setup.ts'], {
  cwd: __dirname,
  stdio: 'inherit',
});

/**
 * End-to-end suite for the admin SPA, driving a real Chromium browser
 * against a real Angular dev server, a real NestJS API instance, and a
 * real Go inventory instance — see `e2e/support/test-env.ts` for the full
 * test-infrastructure strategy (dedicated databases, isolated Redis index,
 * port assignments) and `e2e/global-setup.ts` for how all three services'
 * databases are reset/reseeded, and how `apps/inventory`'s own seed step
 * (which itself needs a running `apps/api`) is bootstrapped before this
 * `webServer` array ever starts (see the module-level `execFileSync` call
 * above for *why* that bootstrap is triggered this way instead of via
 * Playwright's own `globalSetup:` field).
 *
 * `webServer` starts all three processes and waits for each to report
 * healthy before any test runs. Order matters most for `api` before
 * `admin` (the admin app calls the API on nearly every screen); `inventory`
 * is started first here purely so it is already reachable by the time any
 * admin screen triggers a stock lookup, though strict ordering between
 * `inventory` and `api` is less critical since `api` only calls
 * `inventory` on demand, per request, rather than at its own boot time.
 * `reuseExistingServer` is left off (default `false`) so every local run
 * gets fresh processes bound to the just-reset test databases.
 *
 * The admin dev server is started with Angular CLI's dev-server proxy
 * support (`--proxy-config proxy.conf.json`, targeting `TEST_API_PORT`) so
 * that `ApiClient`'s relative `/api/v1/...` requests — same-origin in
 * production via nginx, but with no such reverse proxy in front of
 * `ng serve` by default — resolve to this suite's `apps/api` instance. This
 * is dev-tooling only: `proxy.conf.json` is never referenced by the
 * production build or `apps/admin/Dockerfile`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Generous per-test timeout: several specs drive many sequential
  // navigations against an `ng serve` dev server doing on-demand
  // compilation on first hit, plus real HTTP round trips to both the API
  // and (for the stock scenario) the Go inventory service behind it.
  timeout: 60_000,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: TEST_ADMIN_BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'go run ./cmd/server',
      cwd: INVENTORY_ROOT,
      env: INVENTORY_SERVER_ENV,
      url: `${TEST_INVENTORY_BASE_URL}/health`,
      timeout: 60_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command:
        'node_modules/.bin/prisma generate && node_modules/.bin/nest build && node dist/main.js',
      cwd: API_ROOT,
      env: API_SERVER_ENV,
      url: `${TEST_API_BASE_URL}/api/health`,
      timeout: 60_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `node_modules/.bin/ng serve --port ${TEST_ADMIN_PORT} --proxy-config proxy.conf.json`,
      cwd: __dirname,
      env: ADMIN_SERVER_ENV,
      url: TEST_ADMIN_BASE_URL,
      timeout: 60_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
