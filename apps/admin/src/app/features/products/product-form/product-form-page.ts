import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import { Category, Product, ProductsService, StockInfo } from '../products.service';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface ProductFormControls {
  name: FormControl<string>;
  slug: FormControl<string>;
  description: FormControl<string>;
  priceDollars: FormControl<number | null>;
  imageUrl: FormControl<string>;
  categoryId: FormControl<string>;
}

/** Sentinel distinguishing "save failed" (message already set) from "save succeeded". */
const SAVE_FAILED = Symbol('product-save-failed');

/**
 * Product create/edit form, reused for both `/products/new` and
 * `/products/:id/edit` via an `ActivatedRoute` param check. Price is entered
 * as a decimal USD amount and converted to/from integer cents at the API
 * boundary (`priceCents = round(priceDollars * 100)`), keeping the DTO's
 * wire format out of the UI.
 *
 * The stock-correction control (edit mode only) is an independent action
 * with its own save button/request — `PATCH /admin/inventory/:productId` is
 * a separate backend call from the product-details `PATCH /products/:id`,
 * so the two must not be coupled into a single submit.
 */
@Component({
  selector: 'app-product-form-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './product-form-page.html',
  styleUrl: './product-form-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFormPage implements OnInit {
  private readonly productsService = inject(ProductsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly categories = signal<readonly Category[]>([]);

  protected readonly isEditMode = signal(false);
  private productId: string | null = null;

  protected readonly stockLoading = signal(false);
  protected readonly stockSubmitting = signal(false);
  protected readonly stockErrorMessage = signal<string | null>(null);
  protected readonly stock = signal<StockInfo | null>(null);
  protected readonly stockControl = new FormControl<number | null>(null, {
    validators: [Validators.required, Validators.min(0)],
  });

  protected readonly form = new FormGroup<ProductFormControls>({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    slug: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(SLUG_PATTERN)],
    }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    priceDollars: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(0.01)],
    }),
    imageUrl: new FormControl('', { nonNullable: true }),
    categoryId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  ngOnInit(): void {
    this.productsService.listCategories().subscribe({
      next: (categories) => this.categories.set(categories),
      error: () => {
        // Non-fatal: the dropdown just stays empty; the form as a whole
        // still surfaces its own load/save errors independently.
      },
    });

    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) {
      return;
    }

    this.isEditMode.set(true);
    this.productId = idParam;
    this.loading.set(true);

    forkJoin({
      product: this.productsService.getById(idParam),
      stock: this.productsService.getStock(idParam),
    })
      .pipe(
        catchError(() => {
          this.errorMessage.set('Failed to load the product. Please try again.');
          return of(null);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe((result) => {
        if (!result) {
          return;
        }
        this.populateForm(result.product);
        this.stock.set(result.stock);
        this.stockControl.setValue(result.stock?.quantity ?? null);
      });
  }

  protected submit(): void {
    if (this.submitting()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.submitting.set(true);

    const { name, slug, description, priceDollars, imageUrl, categoryId } = this.form.getRawValue();
    const input = {
      name,
      slug,
      description,
      priceCents: Math.round((priceDollars ?? 0) * 100),
      imageUrl: imageUrl || undefined,
      categoryId,
    };

    const save$ =
      this.isEditMode() && this.productId
        ? this.productsService.update(this.productId, input)
        : this.productsService.create(input);

    save$
      .pipe(
        catchError((error: unknown) => {
          this.errorMessage.set(this.toErrorMessage(error));
          return of(SAVE_FAILED);
        }),
        finalize(() => this.submitting.set(false)),
      )
      .subscribe((result) => {
        if (result === SAVE_FAILED) {
          return;
        }
        void this.router.navigate(['/products']);
      });
  }

  protected cancel(): void {
    void this.router.navigate(['/products']);
  }

  protected saveStock(): void {
    if (this.stockSubmitting() || !this.productId || this.stockControl.invalid) {
      this.stockControl.markAsTouched();
      return;
    }

    const quantity = this.stockControl.value;
    if (quantity === null) {
      return;
    }

    this.stockErrorMessage.set(null);
    this.stockSubmitting.set(true);

    this.productsService
      .setStock(this.productId, quantity)
      .pipe(
        catchError(() => {
          this.stockErrorMessage.set('Failed to update stock. Please try again.');
          return of(null);
        }),
        finalize(() => this.stockSubmitting.set(false)),
      )
      .subscribe((result) => {
        if (result) {
          this.stock.set(result);
        }
      });
  }

  private populateForm(product: Product): void {
    this.form.setValue({
      name: product.name,
      slug: product.slug,
      description: product.description,
      priceDollars: product.priceCents / 100,
      imageUrl: product.imageUrl ?? '',
      categoryId: product.categoryId,
    });
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 409) {
        return 'A product with this slug already exists. Choose a different slug.';
      }
      const message = (error.error as { message?: string | string[] } | null)?.message;
      if (typeof message === 'string') {
        return message;
      }
      if (Array.isArray(message) && message.length > 0) {
        return message.join(' ');
      }
    }
    return 'Failed to save the product. Please try again.';
  }
}
