import { randomUUID } from 'node:crypto';

import type { Page } from '@playwright/test';

import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, TEST_API_BASE_URL } from './test-env';

/** Short random suffix so emails/slugs stay unique across specs and reruns within a single test run. */
export function uniqueSuffix(): string {
  return randomUUID().slice(0, 8);
}

export interface TestUser {
  name: string;
  email: string;
  password: string;
}

/** Builds a fresh, never-before-seen customer identity for register/login flows. */
export function buildTestUser(namePrefix = 'E2E Customer'): TestUser {
  return {
    name: namePrefix,
    email: `customer-${uniqueSuffix()}@example.com`,
    password: 'Sup3r-Secret!1',
  };
}

interface ApiEnvelope<T> {
  data: T;
}

/**
 * Direct HTTP helpers against the spawned test API instance, bypassing the
 * admin UI entirely. Used only for setup steps the admin app has no reason
 * to expose itself — e.g. registering a CUSTOMER account, or placing an
 * order as that customer so the ADMIN order-list/detail scenario has
 * something real to browse. Every actual admin-facing flow under test still
 * goes through the real browser and the real Angular pages.
 */
async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${TEST_API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Test API request failed: ${init.method ?? 'GET'} ${path} -> ${response.status} ${body}`,
    );
  }
  const text = await response.text();
  return text.length > 0 ? (JSON.parse(text) as T) : (undefined as T);
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Registers a fresh CUSTOMER account directly via the API and logs it in, returning its access token. */
export async function registerCustomerDirect(user: TestUser): Promise<string> {
  await apiRequest('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(user),
  });
  const { data } = await apiRequest<ApiEnvelope<TokenPair>>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: user.email, password: user.password }),
  });
  return data.accessToken;
}

export async function loginAsAdminDirect(): Promise<string> {
  const { data } = await apiRequest<ApiEnvelope<TokenPair>>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD }),
  });
  return data.accessToken;
}

export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
}

/**
 * Reads the catalog directly from the API (public endpoint, no auth
 * needed), sorted oldest-first.
 *
 * `sort=createdAt:asc` matters here: the default sort is newest-first, and
 * this suite's own specs (`products.spec.ts`, `categories.spec.ts`) create
 * additional products through the UI. Since specs run in a fixed order
 * within one `playwright test` invocation, by the time a later spec calls
 * this helper, a newest-first listing's first entries would be those
 * freshly-created test products rather than the original catalog. That
 * matters concretely for `stock.spec.ts`: only the 12 catalog products from
 * `apps/api/prisma/seed.ts` have a stock row (`apps/inventory`'s own seed
 * step only covers that fixed slug list — see `global-setup.ts`), so
 * picking a UI-created product for the stock scenario would incorrectly
 * find "no stock data" instead of exercising a real lookup/correction.
 * Sorting oldest-first guarantees the original seeded catalog is returned
 * before any test-created product.
 */
export async function listProductsDirect(): Promise<ProductSummary[]> {
  const { data } = await apiRequest<ApiEnvelope<ProductSummary[]>>(
    '/api/v1/products?limit=100&sort=createdAt:asc',
  );
  return data;
}

export interface CategorySummary {
  id: string;
  slug: string;
  name: string;
}

/** Reads the full category list directly from the API. */
export async function listCategoriesDirect(): Promise<CategorySummary[]> {
  const { data } = await apiRequest<ApiEnvelope<CategorySummary[]>>('/api/v1/categories');
  return data;
}

/**
 * Places a single-item order as the given CUSTOMER access token, returning
 * the created order's id. Used to give the ADMIN order list/detail
 * scenario a real, cross-customer order to browse without driving the
 * (nonexistent, storefront-only) checkout UI from this suite.
 */
export async function placeOrderDirect(
  customerAccessToken: string,
  productId: string,
  quantity = 1,
): Promise<string> {
  const { data } = await apiRequest<ApiEnvelope<{ id: string }>>('/api/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerAccessToken}` },
    body: JSON.stringify({ items: [{ productId, quantity }] }),
  });
  return data.id;
}

/**
 * Logs into the admin SPA through the real `/login` form as the seeded
 * ADMIN user, and waits for the redirect to the dashboard (`/`) that
 * `LoginPage` performs once it confirms the authenticated user's role is
 * `ADMIN`.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(TEST_ADMIN_EMAIL);
  await page.getByLabel('Password').fill(TEST_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => url.pathname === '/');
}

/**
 * Submits the `/login` form as the given (non-admin) user. Does not wait
 * for any redirect: the whole point of the "CUSTOMER login is rejected"
 * scenario is that no navigation away from `/login` ever happens, so the
 * caller is expected to assert on the resulting error state itself.
 */
export async function submitLogin(
  page: Page,
  user: Pick<TestUser, 'email' | 'password'>,
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}
