import { expect, test } from '@playwright/test';

import { listCategoriesDirect, loginAsAdmin, uniqueSuffix } from './support/fixtures';
import { confirmDialog, tableRow } from './support/ui-helpers';

test.describe('products: create, edit, soft-delete', () => {
  test('create a product, edit it, soft-delete it, each reflected in the list', async ({
    page,
  }) => {
    const categories = await listCategoriesDirect();
    expect(categories.length).toBeGreaterThan(0);
    const category = categories[0];

    const suffix = uniqueSuffix();
    const name = `E2E Product ${suffix}`;
    const slug = `e2e-product-${suffix}`;
    const editedName = `E2E Product ${suffix} (edited)`;

    await loginAsAdmin(page);

    // --- Create ---
    await page.goto('/products/new');
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Slug').fill(slug);
    await page.getByLabel('Description').fill('Created by the admin Playwright suite.');
    await page.getByLabel('Price (USD)').fill('19.99');
    await page.getByLabel('Category').click();
    await page.getByRole('option', { name: category.name }).click();
    await page.getByRole('button', { name: 'Save' }).click();

    await page.waitForURL('**/products');
    await page.getByLabel('Search').fill(name);
    await expect(tableRow(page, name)).toBeVisible();

    // --- Edit ---
    await tableRow(page, name).click();
    await page.waitForURL(/\/products\/.+\/edit$/);
    await expect(page.getByRole('heading', { name: 'Edit Product' })).toBeVisible();
    await page.getByLabel('Name').fill(editedName);
    await page.getByRole('button', { name: 'Save' }).click();

    await page.waitForURL('**/products');
    await page.getByLabel('Search').fill(editedName);
    await expect(tableRow(page, editedName)).toBeVisible();

    // --- Soft-delete ---
    await tableRow(page, editedName).getByRole('button', { name: 'Delete product' }).click();
    await confirmDialog(page, 'Delete');

    // The public product-listing endpoint this list is built on filters
    // isActive: true internally, so a soft-deleted product disappears from
    // the list entirely rather than showing as "Inactive".
    await expect(tableRow(page, editedName)).toHaveCount(0);
  });
});
