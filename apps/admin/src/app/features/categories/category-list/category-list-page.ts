import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  TemplateRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';

import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { DataTable, DataTableColumn } from '../../../shared/components/data-table/data-table';
import { Category, CategoriesService } from '../categories.service';

/** Sentinel distinguishing "delete cancelled" from "delete succeeded". */
const DELETE_CANCELLED = Symbol('category-delete-cancelled');

/**
 * `/categories` route: unpaginated category list (small dataset — the
 * backend returns everything in one response, `DataTable`'s paginator is
 * still used for a consistent look but effectively shows a single page).
 * Row click navigates to the edit form; a "New Category" button navigates
 * to the create form; a per-row delete action confirms via
 * `ConfirmDialogService` before calling `CategoriesService.delete`.
 *
 * Deleting a category that still has products fails with a `409` whose
 * message names the category and product count (see `apps/api`'s
 * `DeleteCategoryUseCase`). That message is surfaced verbatim via
 * `MatSnackBar` rather than replaced with a generic failure message, per
 * this task's explicit requirement.
 */
@Component({
  selector: 'app-category-list-page',
  imports: [DataTable, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './category-list-page.html',
  styleUrl: './category-list-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryListPage implements OnInit {
  private readonly categoriesService = inject(CategoriesService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  private readonly actionsTemplate =
    viewChild.required<TemplateRef<{ $implicit: Category }>>('actionsCell');

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly rows = signal<readonly Category[]>([]);
  protected readonly total = signal(0);

  protected get columns(): readonly DataTableColumn<Category>[] {
    return [
      { key: 'name', label: 'Name' },
      { key: 'slug', label: 'Slug' },
      { key: 'id', label: 'Actions', cellTemplate: this.actionsTemplate() },
    ];
  }

  ngOnInit(): void {
    this.loadCategories();
  }

  protected createCategory(): void {
    void this.router.navigate(['/categories/new']);
  }

  protected editCategory(row: Category): void {
    void this.router.navigate(['/categories', row.id, 'edit']);
  }

  protected deleteCategory(row: Category): void {
    this.confirmDialog
      .confirm({
        title: 'Delete category',
        message: `Delete "${row.name}"? This cannot be undone.`,
        confirmLabel: 'Delete',
      })
      .pipe(
        switchMap((confirmed) => {
          if (!confirmed) {
            return of(DELETE_CANCELLED);
          }
          return this.categoriesService.delete(row.id);
        }),
      )
      .subscribe({
        next: (result) => {
          if (result === DELETE_CANCELLED) {
            return;
          }
          this.loadCategories();
        },
        error: (error: unknown) => {
          this.snackBar.open(this.toDeleteErrorMessage(error), 'Dismiss', { duration: 8000 });
        },
      });
  }

  private loadCategories(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.categoriesService
      .list()
      .pipe(
        catchError(() => {
          this.errorMessage.set('Failed to load categories. Please try again.');
          return of(null);
        }),
      )
      .subscribe((response) => {
        this.loading.set(false);
        if (!response) {
          return;
        }
        this.rows.set(response.data);
        this.total.set(response.meta.total);
      });
  }

  /**
   * A `409` here means the category still has associated products; the
   * API's own message names the category and product count (see
   * `apps/api`'s `DeleteCategoryUseCase`), so it is shown as-is rather than
   * a generic "failed" message.
   */
  private toDeleteErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const message = (error.error as { message?: string | string[] } | null)?.message;
      if (typeof message === 'string') {
        return message;
      }
      if (Array.isArray(message) && message.length > 0) {
        return message.join(' ');
      }
    }
    return 'Failed to delete the category. Please try again.';
  }
}
