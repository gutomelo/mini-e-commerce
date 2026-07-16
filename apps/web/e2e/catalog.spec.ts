import { expect, test } from '@playwright/test';

test.describe('catalog: pagination and filters reflected in the URL', () => {
  test('search filter updates the URL and narrows the results', async ({ page }) => {
    await page.goto('/products');

    await page.getByLabel('Search').fill('Headphones');
    await page.getByRole('button', { name: 'Apply' }).click();

    await expect(page).toHaveURL(/[?&]search=Headphones/);
    await expect(page.getByRole('link', { name: /Wireless Bluetooth Headphones/ })).toBeVisible();
    // A product from a clearly unrelated name should be filtered out.
    await expect(page.getByRole('link', { name: /Cast Iron Skillet/ })).toHaveCount(0);

    // "Clear" removes the filter and returns to the unfiltered URL.
    await page.getByRole('link', { name: 'Clear' }).click();
    await expect(page).toHaveURL(/\/products$/);
  });

  test('category filter updates the URL and narrows the results', async ({ page }) => {
    await page.goto('/products');

    await page.getByLabel('Category').selectOption('apparel');
    await page.getByRole('button', { name: 'Apply' }).click();

    await expect(page).toHaveURL(/[?&]category=apparel/);
    await expect(page.getByRole('link', { name: /Classic Cotton T-Shirt/ })).toBeVisible();
    // An electronics product should not appear under the apparel filter.
    await expect(page.getByRole('link', { name: /Wireless Bluetooth Headphones/ })).toHaveCount(0);
  });

  test('pagination is reflected in the URL and shows different products per page', async ({
    page,
  }) => {
    // The seeded catalog has 12 products; requesting a small page size
    // through the URL (the API's `limit` query param, per
    // `ListProductsQueryDto`) is the most direct way to exercise multiple
    // pages without depending on the product-filter form, which doesn't
    // expose a page-size control.
    await page.goto('/products?limit=5');

    await expect(page.getByText('Page 1 of 3')).toBeVisible();
    const nextLink = page.getByRole('link', { name: 'Next' });
    await expect(nextLink).toBeVisible();
    // The Pagination component builds this href from the current page
    // number, so its target already proves "page" is part of the URL state
    // before any click happens.
    await expect(nextLink).toHaveAttribute('href', /[?&]page=2/);

    const firstPageProductNames = await page
      .locator('[data-slot="product-card"]')
      .allTextContents();
    expect(firstPageProductNames.length).toBe(5);

    await page.goto('/products?limit=5&page=2');
    await expect(page).toHaveURL(/[?&]page=2/);
    await expect(page.getByText('Page 2 of 3')).toBeVisible();

    const secondPageProductNames = await page
      .locator('[data-slot="product-card"]')
      .allTextContents();
    expect(secondPageProductNames.length).toBe(5);
    expect(secondPageProductNames).not.toEqual(firstPageProductNames);
  });
});
