import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import * as path from 'node:path';

import { Client } from 'pg';
import Redis from 'ioredis';

import {
  API_SERVER_ENV,
  INVENTORY_SERVER_ENV,
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  TEST_API_BASE_URL,
  TEST_DATABASE_NAME,
  TEST_DATABASE_URL,
  TEST_INVENTORY_DATABASE_NAME,
  TEST_INVENTORY_DATABASE_URL,
  TEST_MAINTENANCE_DATABASE_URL,
  TEST_REDIS_URL,
} from './support/test-env';

const API_ROOT = path.resolve(__dirname, '../../api');
const INVENTORY_ROOT = path.resolve(__dirname, '../../inventory');

const HEALTH_POLL_INTERVAL_MS = 500;
const HEALTH_POLL_TIMEOUT_MS = 60_000;

/**
 * The full database/seed bootstrap for this suite. Runs once per
 * `playwright test` invocation, guaranteed to complete before any of
 * `playwright.config.ts`'s `webServer` processes are started.
 *
 * This is *not* wired up as Playwright's own `globalSetup:` config field —
 * see the doc comment on the `execFileSync` call at the top of
 * `playwright.config.ts` for why: that config field actually runs *after*
 * `webServer` processes have already started in this Playwright version,
 * which is too late for `apps/inventory` (it pings its database
 * synchronously at boot, before serving `/health`). Instead,
 * `playwright.config.ts` invokes this function synchronously (via
 * `e2e/run-global-setup.ts` + a blocking `execFileSync` call) at module-load
 * time, before it ever constructs the `webServer` array.
 *
 * This suite is the one Playwright suite in the repo whose scenarios need a
 * real, running `apps/inventory` Go instance in addition to `apps/api` and
 * `apps/admin` — see `support/test-env.ts`'s doc comment for why (in short:
 * `apps/api`'s `HttpInventoryClient` always wires the real inventory client,
 * so there is no fake to swap in for the "stock lookup/correction" scenario).
 * That creates a bootstrapping problem this function solves:
 *
 *   1. Reset+reseed `apps/api`'s dedicated test database directly (Prisma
 *      migrate + truncate + `prisma/seed.ts`), exactly like `apps/web`'s and
 *      `apps/api`'s own `global-setup.ts` — no HTTP involved.
 *   2. Migrate a dedicated `apps/inventory` test database directly via
 *      `go run ./cmd/migrate` — also no HTTP involved.
 *   3. `apps/inventory`'s own seed step (`go run ./cmd/seed`) needs to
 *      resolve each of its 12 known product slugs to real ids by calling a
 *      *running* `apps/api` instance's `GET /api/v1/products` — but
 *      `playwright.config.ts`'s `webServer` array starts each process once
 *      and expects it to stay up for the whole run, so it cannot itself
 *      depend on `apps/inventory` having already been seeded before `api`
 *      exists. This function breaks that cycle by temporarily spawning its
 *      own throwaway `apps/api` process on the same port the real
 *      `webServer` entry will later reuse, waiting for it to become
 *      healthy, running the Go seed against it, then killing it again.
 *   4. `playwright.config.ts`'s own `webServer` array then starts fresh,
 *      long-lived `inventory` -> `api` -> `admin` processes for the actual
 *      test run, bound to the exact same already-migrated-and-seeded
 *      databases this function just prepared.
 *
 * This mirrors how a real deployment would actually bootstrap this
 * dependency chain (databases first, then a coordinated one-time seed step,
 * then the long-lived services) — just automated for a repeatable local
 * test run.
 */
export default async function globalSetup(): Promise<void> {
  // Step 1: apps/api's dedicated test database.
  await ensureApiTestDatabaseExists();
  runApiMigrations();
  await truncateApiTables();
  runApiSeed();
  await flushTestRedisDb();

  // Step 2: apps/inventory's own dedicated test database.
  runInventoryMigrations();

  // Step 3: temporary apps/api instance, just long enough for
  // apps/inventory's seed step to resolve product slugs to ids against it.
  await seedInventoryViaTemporaryApi();

  // Step 4 (starting fresh, long-lived inventory -> api -> admin processes)
  // is left to playwright.config.ts's own `webServer` array.
}

async function ensureApiTestDatabaseExists(): Promise<void> {
  const client = new Client({ connectionString: TEST_MAINTENANCE_DATABASE_URL });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      TEST_DATABASE_NAME,
    ]);
    if (rowCount === 0) {
      // Database names cannot be parameterized; TEST_DATABASE_NAME is a
      // fixed constant (not user input), so this is safe.
      await client.query(`CREATE DATABASE ${TEST_DATABASE_NAME}`);
    }
  } finally {
    await client.end();
  }
}

function runApiMigrations(): void {
  execFileSync('node_modules/.bin/prisma', ['migrate', 'deploy'], {
    cwd: API_ROOT,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}

function runApiSeed(): void {
  execFileSync('node_modules/.bin/tsx', ['prisma/seed.ts'], {
    cwd: API_ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      ADMIN_EMAIL: TEST_ADMIN_EMAIL,
      ADMIN_PASSWORD: TEST_ADMIN_PASSWORD,
    },
  });
}

async function truncateApiTables(): Promise<void> {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      'TRUNCATE TABLE "RefreshToken", "OrderItem", "Order", "Product", "Category", "User" RESTART IDENTITY CASCADE',
    );
  } finally {
    await client.end();
  }
}

async function flushTestRedisDb(): Promise<void> {
  const redis = new Redis(TEST_REDIS_URL);
  try {
    await redis.flushdb();
  } finally {
    redis.disconnect();
  }
}

/**
 * `go run ./cmd/migrate` creates `mini_ecommerce_inventory_test` (if
 * missing) and applies every pending migration, talking directly to
 * Postgres — no running `apps/api`/`apps/inventory` HTTP server needed for
 * this step, matching how `apps/inventory/README.md` documents standalone
 * migration.
 */
function runInventoryMigrations(): void {
  execFileSync('go', ['run', './cmd/migrate'], {
    cwd: INVENTORY_ROOT,
    stdio: 'inherit',
    env: { ...process.env, INVENTORY_DATABASE_URL: TEST_INVENTORY_DATABASE_URL },
  });
}

/**
 * Spawns a throwaway `apps/api` process on the exact port
 * `playwright.config.ts`'s real `webServer` entry will later reuse, waits
 * for `/api/health`, runs `go run ./cmd/seed` against it (which resolves
 * `apps/inventory`'s 12 known product slugs to the ids this run's
 * `runApiSeed()` just created), then kills the temporary process.
 *
 * This keeps `apps/inventory`'s one-time seed dependency on a running
 * `apps/api` entirely inside `globalSetup` rather than coupling the two
 * services' startup order in `playwright.config.ts` itself, which starts
 * each `webServer` process once and expects it to stay up for the whole
 * test run.
 */
async function seedInventoryViaTemporaryApi(): Promise<void> {
  // `detached: true` makes this process the leader of its own new process
  // group (rather than joining this script's group), which is what makes
  // `stopProcess` below able to kill it and every process it spawns in one
  // shot. This matters because the command chains three steps with `&&` in
  // a shell: `prisma generate && nest build && node dist/main.js` runs as a
  // shell process that execs/forks `node dist/main.js` as its own child —
  // sending SIGTERM only to the shell would not reliably reach that
  // grandchild, leaving an orphaned `apps/api` process bound to
  // `TEST_API_PORT` behind (observed in practice: the actual long-lived
  // `apps/api` `webServer` process failed to bind that same port on the
  // next run).
  const apiProcess = spawn(
    'node_modules/.bin/prisma generate && node_modules/.bin/nest build && node dist/main.js',
    {
      cwd: API_ROOT,
      env: { ...process.env, ...API_SERVER_ENV },
      stdio: 'inherit',
      shell: true,
      detached: true,
    },
  );

  try {
    await waitForHealthy(`${TEST_API_BASE_URL}/api/health`);
    runInventorySeed();
  } finally {
    await stopProcess(apiProcess);
  }
}

function runInventorySeed(): void {
  execFileSync('go', ['run', './cmd/seed'], {
    cwd: INVENTORY_ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      API_BASE_URL: TEST_API_BASE_URL,
      INVENTORY_DATABASE_URL: TEST_INVENTORY_DATABASE_URL,
    },
  });
}

async function waitForHealthy(url: string): Promise<void> {
  const deadline = Date.now() + HEALTH_POLL_TIMEOUT_MS;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`Unexpected status ${response.status} from ${url}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_INTERVAL_MS));
  }

  throw new Error(
    `Timed out waiting for ${url} to become healthy: ${String(lastError)}. ` +
      'The temporary apps/api instance used to seed apps/inventory never came up.',
  );
}

/**
 * Kills the entire process group `childProcess` leads (its own shell plus
 * whatever that shell forked, e.g. `node dist/main.js`), not just the
 * immediate child. `childProcess` must have been spawned with
 * `detached: true` for the negative-pid form of `process.kill` to target
 * the whole group rather than only the shell.
 */
async function stopProcess(childProcess: ChildProcess): Promise<void> {
  if (childProcess.exitCode !== null || childProcess.killed || !childProcess.pid) {
    return;
  }

  const pid = childProcess.pid;

  await new Promise<void>((resolve) => {
    childProcess.once('exit', () => resolve());
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      // The group may already be gone; fall through to the resolve below
      // once 'exit' fires, or the SIGKILL fallback if it never does.
    }
    // Fallback in case the group ignores SIGTERM.
    setTimeout(() => {
      if (childProcess.exitCode === null) {
        try {
          process.kill(-pid, 'SIGKILL');
        } catch {
          // Already gone.
        }
      }
    }, 5_000).unref();
  });
}
