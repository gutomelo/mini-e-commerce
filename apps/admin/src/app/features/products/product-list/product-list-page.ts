import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  TemplateRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PageEvent } from '@angular/material/paginator';
import { Router } from '@angular/router';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  forkJoin,
  map,
  of,
  switchMap,
} from 'rxjs';

import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { DataTable, DataTableColumn } from '../../../shared/components/data-table/data-table';
import { Category, Product, ProductsService } from '../products.service';

/** Row shape rendered by `DataTable`: the raw product plus derived display fields. */
interface ProductRow extends Product {
  readonly categoryName: string;
  readonly priceDisplay: string;
  readonly statusText: string;
  readonly stockDisplay: string;
}

function formatPrice(priceCents: number): string {
  return `$${(priceCents / 100).toFixed(2)}`;
}

/**
 * `/products` route: paginated, searchable product list. Row click navigates
 * to the edit form; a "New Product" button navigates to the create form; a
 * per-row delete action confirms via `ConfirmDialogService` before calling
 * `ProductsService.delete` and refreshing the page.
 *
 * Stock quantity is fetched per visible row via `forkJoin` over the current
 * page's product ids, using `ProductsService.getStock` (which already
 * tolerates a missing stock row by resolving to `null`).
 */
@Component({
  selector: 'app-product-list-page',
  imports: [
    DataTable,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
  ],
  templateUrl: './product-list-page.html',
  styleUrl: './product-list-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductListPage implements OnInit {
  private readonly productsService = inject(ProductsService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  private readonly actionsTemplate =
    viewChild.required<TemplateRef<{ $implicit: ProductRow }>>('actionsCell');

  protected readonly searchControl = new FormControl('', { nonNullable: true });

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly rows = signal<readonly ProductRow[]>([]);
  protected readonly total = signal(0);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(10);

  private categories: readonly Category[] = [];

  protected get columns(): readonly DataTableColumn<ProductRow>[] {
    return [
      { key: 'name', label: 'Name' },
      { key: 'slug', label: 'Slug' },
      { key: 'priceDisplay', label: 'Price' },
      { key: 'categoryName', label: 'Category' },
      { key: 'statusText', label: 'Status' },
      { key: 'stockDisplay', label: 'Stock' },
      { key: 'id', label: 'Actions', cellTemplate: this.actionsTemplate() },
    ];
  }

  ngOnInit(): void {
    this.productsService.listCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
        this.loadProducts();
      },
      error: () => {
        // Category names are a display nicety; fall back to showing the raw
        // categoryId rather than blocking the whole list from loading.
        this.loadProducts();
      },
    });

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => {
        this.pageIndex.set(0);
        this.loadProducts();
      });
  }

  protected onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadProducts();
  }

  protected createProduct(): void {
    void this.router.navigate(['/products/new']);
  }

  protected editProduct(row: ProductRow): void {
    void this.router.navigate(['/products', row.id, 'edit']);
  }

  protected deleteProduct(row: ProductRow): void {
    this.confirmDialog
      .confirm({
        title: 'Delete product',
        message: `Delete "${row.name}"? This soft-deletes the product (it becomes inactive).`,
        confirmLabel: 'Delete',
      })
      .pipe(
        switchMap((confirmed) => {
          if (!confirmed) {
            return of(null);
          }
          return this.productsService.delete(row.id);
        }),
      )
      .subscribe({
        next: (result) => {
          if (result === null) {
            return;
          }
          this.loadProducts();
        },
        error: () => {
          this.snackBar.open('Failed to delete the product. Please try again.', 'Dismiss', {
            duration: 5000,
          });
        },
      });
  }

  private loadProducts(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.productsService
      .list({
        page: this.pageIndex() + 1,
        limit: this.pageSize(),
        search: this.searchControl.value || undefined,
      })
      .pipe(
        switchMap((response) => {
          this.total.set(response.meta.total);
          if (response.data.length === 0) {
            return of([] as ProductRow[]);
          }
          return forkJoin(
            response.data.map((product) =>
              this.productsService
                .getStock(product.id)
                .pipe(map((stock) => this.toRow(product, stock?.quantity ?? null))),
            ),
          );
        }),
        catchError(() => {
          this.errorMessage.set('Failed to load products. Please try again.');
          return of([] as ProductRow[]);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe((rows) => this.rows.set(rows));
  }

  private toRow(product: Product, stockQuantity: number | null): ProductRow {
    const category = this.categories.find((c) => c.id === product.categoryId);
    return {
      ...product,
      categoryName: category?.name ?? product.categoryId,
      priceDisplay: formatPrice(product.priceCents),
      statusText: product.isActive ? 'Active' : 'Inactive',
      stockDisplay: stockQuantity === null ? 'No stock data' : String(stockQuantity),
    };
  }
}
