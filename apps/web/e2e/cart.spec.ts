import { expect, test } from '@playwright/test';

/** Marks the current document so a later check can prove no full page reload happened in between. */
async function markDocument(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __e2eMarker: boolean }).__e2eMarker = true;
  });
}

async function documentStillMarked(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(() => Boolean((window as unknown as { __e2eMarker?: boolean }).__e2eMarker));
}

test.describe('cart: add, update, and remove without a full page reload', () => {
  test('adding, bumping quantity, and removing an item all avoid a full page reload', async ({
    page,
  }) => {
    await page.goto('/products/wireless-bluetooth-headphones');
    await markDocument(page);

    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.getByRole('button', { name: 'Added to cart' })).toBeVisible();
    await expect(page.getByLabel('Cart, 1 item')).toBeVisible();
    expect(await documentStillMarked(page)).toBe(true);

    await page.getByRole('link', { name: 'View cart' }).click();
    await expect(page.getByRole('heading', { name: 'Your cart' })).toBeVisible();
    await expect(page.getByText('Wireless Bluetooth Headphones')).toBeVisible();
    // The unit-price span, the (qty=1) line-total span, and the page
    // subtotal all legitimately show the same value for a single qty-1 item.
    await expect(page.getByText('$129.99', { exact: true })).toHaveCount(3);

    await markDocument(page);
    await page.getByRole('button', { name: 'Increase quantity' }).click();
    await expect(page.locator('span[aria-live="polite"]')).toHaveText('2');
    // Both the line total (129.99 * 2) and the page subtotal now show
    // 259.98, so this also legitimately appears twice.
    await expect(page.getByText('$259.98')).toHaveCount(2);
    expect(await documentStillMarked(page)).toBe(true);

    await markDocument(page);
    await page.getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
    expect(await documentStillMarked(page)).toBe(true);

    // The header badge reflects the empty cart too.
    await expect(page.getByLabel('Cart, 0 items')).toBeVisible();
  });

  test('cart contents persist across a page navigation via the cart cookie', async ({ page }) => {
    await page.goto('/products/smart-fitness-watch');
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.getByLabel('Cart, 1 item')).toBeVisible();

    await page.goto('/products');
    await expect(page.getByLabel('Cart, 1 item')).toBeVisible();

    await page.getByRole('link', { name: 'View cart' }).click();
    await expect(page.getByText('Smart Fitness Watch')).toBeVisible();
  });
});
