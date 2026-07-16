import { randomUUID } from 'node:crypto';

import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, TEST_API_BASE_URL } from './test-env';

/** Short random suffix so emails stay unique across specs and reruns within a single test run. */
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
 * storefront entirely. Used only for setup/verification steps the
 * storefront's own UI has no reason to expose — e.g. logging in as the
 * seeded ADMIN user to deactivate a product for the "stale/tampered cart"
 * scenario. Every actual user-facing flow under test still goes through the
 * real browser and the real Next.js pages/Server Actions.
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

export async function loginAsAdminDirect(): Promise<string> {
  const { data } = await apiRequest<ApiEnvelope<{ accessToken: string }>>('/api/v1/auth/login', {
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

/** Reads the seeded catalog directly from the API (public endpoint, no auth needed). */
export async function listProductsDirect(): Promise<ProductSummary[]> {
  const { data } = await apiRequest<ApiEnvelope<ProductSummary[]>>('/api/v1/products?limit=100');
  return data;
}

/**
 * Soft-deletes (deactivates) a product as ADMIN, simulating a product that
 * was deactivated after a shopper already added it to their cart. This is
 * exactly the "stale/tampered cart" scenario from the phase checklist: the
 * cart cookie still references the product id, but the API's authoritative
 * re-check at checkout must reject it rather than trust the cookie.
 */
export async function deactivateProductDirect(productId: string): Promise<void> {
  const accessToken = await loginAsAdminDirect();
  await apiRequest(`/api/v1/products/${productId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
