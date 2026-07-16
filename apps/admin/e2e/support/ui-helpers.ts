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
 * Scoped to the `[matSnackBarLabel]` element `MatSnackBar`'s default
 * template wraps its message in (see `@angular/material/snack-bar`'s
 * `SimpleSnackBar` template) rather than a bare `page.getByText(...)`:
 * a bare text match can resolve to more than one element when the sought
 * text also appears elsewhere on the page at the same moment — e.g. the
 * category name in both the still-rendering `ConfirmDialogService` overlay
 * (mid-close-animation) and the category list row behind it — which
 * Playwright's strict mode then rejects as ambiguous.
 */
export async function expectSnackbar(page: Page, text: string | RegExp): Promise<void> {
  await expect(page.locator('[matSnackBarLabel]')).toContainText(text);
}
