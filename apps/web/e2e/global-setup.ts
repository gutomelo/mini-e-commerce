import { execFileSync } from 'node:child_process';
import * as path from 'node:path';

import { Client } from 'pg';
import Redis from 'ioredis';

import {
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  TEST_DATABASE_NAME,
  TEST_DATABASE_URL,
  TEST_MAINTENANCE_DATABASE_URL,
  TEST_REDIS_URL,
} from './support/test-env';

const API_ROOT = path.resolve(__dirname, '../../api');

/**
 * Playwright `globalSetup`: runs once, before any `webServer` is started and
 * before any test file runs. Gets `mini_ecommerce_test` (the same dedicated
 * database `apps/api`'s own e2e suite uses — see `support/test-env.ts`) into
 * a known, freshly-seeded state, and clears this suite's isolated Redis
 * logical DB so no cached product/category list from a previous run (which
 * would reference product/category ids that no longer exist after a fresh
 * seed) can leak into this run's assertions.
 *
 * This is what makes `pnpm --filter web run test:e2e` idempotent across
 * reruns: whatever a previous run left behind (orders, extra registered
 * users, a deactivated product) is wiped before this run's first test
 * executes, exactly mirroring `apps/api/test/global-setup.ts`'s strategy.
 */
export default async function globalSetup(): Promise<void> {
  await ensureTestDatabaseExists();
  runMigrations();
  await truncateAllTables();
  runSeed();
  await flushTestRedisDb();
}

async function ensureTestDatabaseExists(): Promise<void> {
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

function runMigrations(): void {
  execFileSync('node_modules/.bin/prisma', ['migrate', 'deploy'], {
    cwd: API_ROOT,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}

function runSeed(): void {
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

async function truncateAllTables(): Promise<void> {
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
