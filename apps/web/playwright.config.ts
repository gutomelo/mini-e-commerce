import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

import {
  API_SERVER_ENV,
  TEST_API_BASE_URL,
  TEST_WEB_BASE_URL,
  WEB_SERVER_ENV,
} from './e2e/support/test-env';

const API_ROOT = path.resolve(__dirname, '../api');

/**
 * End-to-end suite for the storefront, driving a real Chromium browser
 * against a real Next.js dev server and a real NestJS API instance — see
 * `e2e/support/test-env.ts` for the full test-infrastructure strategy
 * (dedicated database, isolated Redis index, raised auth throttle limit)
 * and `e2e/global-setup.ts` for how the database is reset/reseeded before
 * every run so reruns stay idempotent.
 *
 * `webServer` starts both processes and waits for each to report healthy
 * before any test runs; `reuseExistingServer` is left off (default `false`
 * outside CI is not set explicitly here) so every local run gets a fresh
 * API process bound to the just-reset test database — starting from a
 * stale, already-running process would defeat the point of resetting the
 * database in `globalSetup`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Generous per-test timeout: several specs drive many sequential
  // navigations against a `next dev` server doing on-demand route
  // compilation on first hit, plus real HTTP round trips to the API.
  timeout: 60_000,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: TEST_WEB_BASE_URL,
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
      command: 'node_modules/.bin/next dev -p 3100',
      cwd: __dirname,
      env: WEB_SERVER_ENV,
      url: TEST_WEB_BASE_URL,
      timeout: 60_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
