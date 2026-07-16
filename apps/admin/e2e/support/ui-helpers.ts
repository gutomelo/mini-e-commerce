import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Confirms (or cancels) the `ConfirmDialogService` modal that guards every
 * destructive action in the admin UI (product/category delete). The dialog
 * is a `MatDialog` overlay, so it is scoped by ARIA `role="dialog"` rather
 * than a CSS class.
 */
export async function confirmDialog(page: Page, confirmLabel = 'Delete'): Promise<void> {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: confirmLabel }).click();
}

/** Locates a `DataTable` row (a `mat-table` `tr[mat-row]`) containing the given text. */
export function tableRow(page: Page, text: string): Locator {
  return page.locator('tr.data-table-row', { hasText: text });
}

/**
 * Waits for a `MatSnackBar` message containing the given text to appear.
 * `MatSnackBar` renders its message as plain visible text inside a live
 * region; matching on the text itself (rather than a specific container
 * class, which varies across Material versions/theming) is the stable way
 * to assert on it.
 */
export async function expectSnackbar(page: Page, text: string | RegExp): Promise<void> {
  await expect(page.getByText(text)).toBeVisible();
}
