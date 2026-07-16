import type { Page } from '@playwright/test';

import type { TestUser } from './fixtures';

/**
 * Registers a fresh account through the real `/register` form and waits for
 * the redirect to `/products` that `registerAction` performs on success
 * (register, then auto-login, then redirect — see `src/actions/auth.ts`).
 */
export async function registerAndLogin(page: Page, user: TestUser): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('Full name').fill(user.name);
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/products');
}

/** Logs an already-registered user in through the real `/login` form. */
export async function login(page: Page, user: Pick<TestUser, 'email' | 'password'>): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/products');
}

/** Visits a product's detail page and clicks "Add to cart" once. */
export async function addProductToCart(page: Page, slug: string): Promise<void> {
  await page.goto(`/products/${slug}`);
  await page.getByRole('button', { name: 'Add to cart' }).click();
}
