import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, of } from 'rxjs';

import { Category, CategoriesService } from '../categories.service';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface CategoryFormControls {
  name: FormControl<string>;
  slug: FormControl<string>;
}

/** Sentinel distinguishing "save failed" (message already set) from "save succeeded". */
const SAVE_FAILED = Symbol('category-save-failed');

/**
 * Category create/edit form, reused for both `/categories/new` and
 * `/categories/:id/edit` via an `ActivatedRoute` param check.
 *
 * `apps/api` has no `GET /categories/:id` endpoint, so edit mode fetches
 * the full (small, unpaginated) category list and finds the matching row
 * in memory rather than adding a network call the backend doesn't offer
 * (see `CategoriesService`'s doc comment for the full rationale).
 */
@Component({
  selector: 'app-category-form-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './category-form-page.html',
  styleUrl: './category-form-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryFormPage implements OnInit {
  private readonly categoriesService = inject(CategoriesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly isEditMode = signal(false);
  private categoryId: string | null = null;

  protected readonly form = new FormGroup<CategoryFormControls>({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    slug: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(SLUG_PATTERN)],
    }),
  });

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) {
      return;
    }

    this.isEditMode.set(true);
    this.categoryId = idParam;
    this.loading.set(true);

    this.categoriesService
      .list()
      .pipe(
        catchError(() => {
          this.errorMessage.set('Failed to load the category. Please try again.');
          return of(null);
        }),
      )
      .subscribe((response) => {
        this.loading.set(false);
        const found = response?.data.find((c) => c.id === idParam) ?? null;
        if (!found) {
          this.errorMessage.set('Failed to load the category. Please try again.');
          return;
        }
        this.populateForm(found);
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

    const { name, slug } = this.form.getRawValue();
    const input = { name, slug };

    const save$ =
      this.isEditMode() && this.categoryId
        ? this.categoriesService.update(this.categoryId, input)
        : this.categoriesService.create(input);

    save$
      .pipe(
        catchError((error: unknown) => {
          this.errorMessage.set(this.toErrorMessage(error));
          return of(SAVE_FAILED);
        }),
      )
      .subscribe((result) => {
        this.submitting.set(false);
        if (result === SAVE_FAILED) {
          return;
        }
        void this.router.navigate(['/categories']);
      });
  }

  protected cancel(): void {
    void this.router.navigate(['/categories']);
  }

  private populateForm(category: Category): void {
    this.form.setValue({ name: category.name, slug: category.slug });
  }

  /**
   * Surfaces the API's own error message (e.g. a duplicate name/slug `409`
   * from `CreateCategoryUseCase`/`UpdateCategoryUseCase`) rather than a
   * generic failure, matching this task's requirement for the delete flow.
   */
  private toErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const message = (error.error as { message?: string | string[] } | null)?.message;
      if (typeof message === 'string') {
        return message;
      }
      if (Array.isArray(message) && message.length > 0) {
        return message.join(' ');
      }
    }
    return 'Failed to save the category. Please try again.';
  }
}
