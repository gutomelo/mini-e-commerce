import { expect, test } from '@playwright/test';

import { buildTestUser } from './support/fixtures';
import { SEEDED_PRODUCTS } from './support/catalog';
import { addProductToCart, registerAndLogin } from './support/ui-helpers';

test.describe('order history: cross-user isolation', () => {
  test('one customer cannot view another customer order via /orders/:id', async ({ browser }) => {
    // Two fully isolated browser contexts so each customer gets their own
    // cookie jar, exactly like two different people on two different
    // computers — a single shared `page`/`context` would blur the identity
    // boundary this test exists to prove.
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    try {
      const pageA = await contextA.newPage();
      const userA = buildTestUser('E2E Customer A');
      await registerAndLogin(pageA, userA);
      await addProductToCart(pageA, SEEDED_PRODUCTS.headphones.slug);
      await pageA.goto('/checkout');
      await pageA.getByRole('button', { name: 'Place order' }).click();
      await pageA.waitForURL(/\/checkout\/confirmation\/.+/);
      const orderId = pageA.url().split('/').pop();
      expect(orderId).toBeTruthy();

      const pageB = await contextB.newPage();
      const userB = buildTestUser('E2E Customer B');
      await registerAndLogin(pageB, userB);

      const response = await pageB.goto(`/orders/${orderId}`);
      expect(response?.status()).toBe(404);

      // The confirmation route resolves the same order through the same
      // scoped `getOrder()` call, so it must 404 for customer B too rather
      // than leaking whether the order id exists.
      const confirmationResponse = await pageB.goto(`/checkout/confirmation/${orderId}`);
      expect(confirmationResponse?.status()).toBe(404);

      // Customer A can still see their own order.
      const ownOrderResponse = await pageA.goto(`/orders/${orderId}`);
      expect(ownOrderResponse?.status()).toBe(200);
      await expect(pageA.getByText(SEEDED_PRODUCTS.headphones.name)).toBeVisible();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
