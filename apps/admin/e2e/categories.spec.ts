import { expect, test } from '@playwright/test';

import { loginAsAdmin, uniqueSuffix } from './support/fixtures';
import { confirmDialog, expectSnackbar, tableRow } from './support/ui-helpers';

test.describe('categories: delete blocked while products exist', () => {
  test("deleting a category that still has products shows the API's 409 message", async ({
    page,
  }) => {
    const suffix = uniqueSuffix();
    const categoryName = `E2E Category ${suffix}`;
    const categorySlug = `e2e-category-${suffix}`;
    const productName = `E2E Category Product ${suffix}`;
    const productSlug = `e2e-category-product-${suffix}`;

    await loginAsAdmin(page);

    // Create the category.
    await page.goto('/categories/new');
    await page.getByLabel('Name').fill(categoryName);
    await page.getByLabel('Slug').fill(categorySlug);
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForURL('**/categories');
    await expect(tableRow(page, categoryName)).toBeVisible();

    // Assign a product to it via the product create form, so the category
    // is no longer deletable.
    await page.goto('/products/new');
    await page.getByLabel('Name').fill(productName);
    await page.getByLabel('Slug').fill(productSlug);
    await page.getByLabel('Description').fill('Assigned to a category under test.');
    await page.getByLabel('Price (USD)').fill('9.99');
    await page.getByLabel('Category').click();
    await page.getByRole('option', { name: categoryName }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForURL('**/products');

    // Attempt to delete the now-in-use category.
    await page.goto('/categories');
    await tableRow(page, categoryName).getByRole('button', { name: 'Delete category' }).click();
    await confirmDialog(page, 'Delete');

    // The API's DeleteCategoryUseCase returns a 409 naming the category and
    // product count; the admin surfaces it verbatim via MatSnackBar.
    await expectSnackbar(page, new RegExp(categoryName));

    // The category must still be present — the delete was rejected, not
    // silently accepted.
    await expect(tableRow(page, categoryName)).toBeVisible();
  });
});
