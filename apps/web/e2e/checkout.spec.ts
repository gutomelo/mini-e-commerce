import { expect, test } from '@playwright/test';

import { buildTestUser, deactivateProductDirect, listProductsDirect } from './support/fixtures';
import { formatCents, SEEDED_PRODUCTS } from './support/catalog';
import { addProductToCart, registerAndLogin } from './support/ui-helpers';

test.describe('checkout', () => {
  test('creates an order with correct snapshot totals, visible in order history', async ({
    page,
  }) => {
    const user = buildTestUser();
    await registerAndLogin(page, user);

    await addProductToCart(page, SEEDED_PRODUCTS.headphones.slug);

    await page.goto('/checkout');
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();

    const expectedTotal = formatCents(SEEDED_PRODUCTS.headphones.priceCents);
    // "Total" label + value appear once each on the checkout page for a
    // single-item, qty-1 cart.
    await expect(page.getByText(expectedTotal)).toHaveCount(2);

    await page.getByRole('button', { name: 'Place order' }).click();
    await page.waitForURL(/\/checkout\/confirmation\/.+/);

    await expect(page.getByRole('heading', { name: 'Order placed!' })).toBeVisible();
    await expect(page.getByText(expectedTotal).last()).toBeVisible();

    const orderId = page.url().split('/').pop();
    expect(orderId).toBeTruthy();

    await page.getByRole('link', { name: 'View all orders' }).click();
    await expect(page.getByRole('heading', { name: 'Your orders' })).toBeVisible();
    await expect(page.getByText(orderId!)).toBeVisible();
    await expect(page.getByText(expectedTotal).last()).toBeVisible();

    await page.getByText(orderId!).click();
    await expect(page).toHaveURL(new RegExp(`/orders/${orderId}$`));
    await expect(page.getByText(SEEDED_PRODUCTS.headphones.name)).toBeVisible();
    await expect(page.getByText(expectedTotal).last()).toBeVisible();
  });

  test('redirects to /login when checking out while unauthenticated', async ({ page }) => {
    await addProductToCart(page, SEEDED_PRODUCTS.fitnessWatch.slug);

    await page.goto('/checkout');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('a stale cart referencing a deactivated product is rejected gracefully at checkout', async ({
    page,
  }) => {
    const user = buildTestUser();
    await registerAndLogin(page, user);

    const products = await listProductsDirect();
    const staleProduct = products.find((p) => p.slug === SEEDED_PRODUCTS.fitnessWatch.slug);
    expect(staleProduct, 'seeded fitness watch product must exist').toBeTruthy();

    await addProductToCart(page, SEEDED_PRODUCTS.headphones.slug);
    await addProductToCart(page, SEEDED_PRODUCTS.fitnessWatch.slug);
    await expect(page.getByLabel('Cart, 2 items')).toBeVisible();

    // Simulate the product being deactivated by an admin after it was added
    // to this shopper's cart — the cart cookie still references its id, but
    // it must never be trusted at checkout time.
    await deactivateProductDirect(staleProduct!.id);

    await page.goto('/checkout');
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
    await expect(page.getByText(SEEDED_PRODUCTS.headphones.name)).toBeVisible();
    // `loadCartRows` swaps the deactivated line item's display name to
    // "Product no longer available" (its `getProduct` call 404s, since
    // inactive products read as not-found); `CheckoutItemRow` additionally
    // renders a dedicated `role="alert"` span with this exact text — matched
    // here via `hasText` (rather than `getByRole`'s `name` accessible-name
    // computation) to sidestep any ambiguity with the similarly-worded line
    // item name text right next to it.
    await expect(page.locator('[role="alert"]', { hasText: 'No longer available' })).toBeVisible();

    await page.getByRole('button', { name: 'Place order' }).click();

    // Two `role="alert"` elements coexist after the rejected submit: the
    // per-item "No longer available" warning (still on screen) and the
    // form-level error from `checkoutAction` — this targets the latter by
    // its distinct text.
    await expect(
      page.locator('[role="alert"]', {
        hasText: 'One or more items in your cart are no longer available',
      }),
    ).toBeVisible();
    // Never silently succeeds: still on /checkout, no order was created.
    await expect(page).toHaveURL(/\/checkout$/);
  });
});
