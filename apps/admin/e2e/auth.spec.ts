import { expect, test } from '@playwright/test';

import {
  buildTestUser,
  loginAsAdmin,
  registerCustomerDirect,
  submitLogin,
} from './support/fixtures';

test.describe('auth: admin login and customer rejection', () => {
  test('ADMIN login reaches the dashboard', async ({ page }) => {
    await loginAsAdmin(page);

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    // A stat tile proves real data loaded, not just the empty shell.
    await expect(page.getByText('Total Products')).toBeVisible();
  });

  test('CUSTOMER login is rejected with a visible message and never reaches an admin screen', async ({
    page,
  }) => {
    const customer = buildTestUser();
    await registerCustomerDirect(customer);

    await submitLogin(page, customer);

    // LoginPage authenticates any valid credentials via the API, then
    // enforces the admin-only rule client-side: a successful HTTP login by
    // a non-ADMIN user is torn back down and the user is kept on /login.
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('This account does not have admin access.')).toBeVisible();

    // Never reaches the app shell / dashboard behind adminGuard.
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toHaveCount(0);
  });
});
