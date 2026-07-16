import { expect, test } from '@playwright/test';

import {
  buildTestUser,
  listProductsDirect,
  loginAsAdmin,
  placeOrderDirect,
  registerCustomerDirect,
} from './support/fixtures';
import { tableRow } from './support/ui-helpers';

test.describe('orders: cross-customer list and detail', () => {
  test('browse the cross-customer order list and open a detail page', async ({ page }) => {
    const customer = buildTestUser();
    const accessToken = await registerCustomerDirect(customer);
    const products = await listProductsDirect();
    expect(products.length).toBeGreaterThan(0);
    const product = products[0];

    // Setup via direct API calls for speed: this scenario is about ADMIN
    // browsing an order placed by a *different* user, not about driving a
    // (nonexistent, storefront-only) checkout UI from this suite.
    await placeOrderDirect(accessToken, product.id, 1);

    await loginAsAdmin(page);
    await page.goto('/orders');

    const row = tableRow(page, customer.email);
    await expect(row).toBeVisible();
    await row.click();

    await page.waitForURL(/\/orders\/.+$/);
    await expect(page.getByText(customer.email)).toBeVisible();
    await expect(page.getByText(product.name)).toBeVisible();
  });
});
