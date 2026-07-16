import { expect, test } from '@playwright/test';

import { listProductsDirect, loginAsAdmin } from './support/fixtures';

test.describe('stock: lookup and correction via the real apps/inventory instance', () => {
  test("look up a product's stock quantity and correct it via the UI, verified by a subsequent lookup", async ({
    page,
  }) => {
    const products = await listProductsDirect();
    expect(products.length).toBeGreaterThan(0);
    const product = products[0];

    await loginAsAdmin(page);
    await page.goto(`/products/${product.id}/edit`);

    await expect(page.getByText('Stock', { exact: true })).toBeVisible();

    // Initial lookup: apps/inventory's own seed step (bootstrapped in
    // global-setup.ts) gives every known seeded product a starting stock
    // quantity, so the field should already be populated with a number
    // rather than showing the "no stock data" state.
    const quantityInput = page.getByLabel('Quantity');
    await expect(quantityInput).not.toHaveValue('');

    const correctedQuantity = 137;
    await quantityInput.fill(String(correctedQuantity));
    await page.getByRole('button', { name: 'Update Stock' }).click();

    // The stock card's own field reflects the just-saved value immediately
    // (ProductFormPage.saveStock sets the `stock` signal from the response).
    await expect(quantityInput).toHaveValue(String(correctedQuantity));

    // Reload the page to force a fresh GET /admin/inventory/:productId
    // lookup against the real apps/inventory instance, proving the
    // correction was actually persisted rather than only reflected
    // optimistically in local component state.
    await page.reload();
    await expect(page.getByLabel('Quantity')).toHaveValue(String(correctedQuantity));
  });
});
