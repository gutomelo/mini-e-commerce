import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import { Client } from 'pg';
import {
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  TEST_DATABASE_NAME,
  TEST_DATABASE_URL,
  TEST_MAINTENANCE_DATABASE_URL,
} from './support/test-env';

const API_ROOT = path.resolve(__dirname, '..');

/**
 * Jest `globalSetup`: runs once, in its own process, before any test file or
 * worker starts. Responsible for getting `mini_ecommerce_test` into a known,
 * freshly-seeded state so:
 *
 *  - every `pnpm --filter api run test:e2e` run starts from the same
 *    baseline regardless of what a previous run left behind (reruns are
 *    idempotent);
 *  - individual spec files never need to coordinate schema setup with each
 *    other.
 *
 * Steps: create the test database if it does not exist yet -> apply
 * migrations with `prisma migrate deploy` -> truncate every table -> reseed
 * (admin user + demo catalog) via the same `prisma/seed.ts` script used in
 * dev/compose, pointed at the test database.
 */
export default async function globalSetup(): Promise<void> {
  await ensureTestDatabaseExists();
  runMigrations();
  await truncateAllTables();
  runSeed();
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
      'TRUNCATE TABLE "RefreshToken", "Product", "Category", "User" RESTART IDENTITY CASCADE',
    );
  } finally {
    await client.end();
  }
}
