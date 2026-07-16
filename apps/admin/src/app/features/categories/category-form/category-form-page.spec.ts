import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import type { ListResponse } from '@mini-e-commerce/types';
import { of, throwError } from 'rxjs';

import { Category, CategoriesService } from '../categories.service';
import { CategoryFormPage } from './category-form-page';

const category: Category = {
  id: 'c1',
  name: 'Electronics',
  slug: 'electronics',
  createdAt: '',
  updatedAt: '',
};

function listResponse(categories: Category[]): ListResponse<Category> {
  return {
    data: categories,
    meta: { page: 1, limit: categories.length, total: categories.length, totalPages: 1 },
  };
}

function createFixture(paramId: string | null): {
  fixture: ComponentFixture<CategoryFormPage>;
  categoriesService: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  router: { navigate: ReturnType<typeof vi.fn> };
} {
  const categoriesService = {
    list: vi.fn().mockReturnValue(of(listResponse([category]))),
    create: vi.fn().mockReturnValue(of(category)),
    update: vi.fn().mockReturnValue(of(category)),
  };
  const router = { navigate: vi.fn().mockResolvedValue(true) };

  TestBed.configureTestingModule({
    imports: [CategoryFormPage, NoopAnimationsModule],
    providers: [
      { provide: CategoriesService, useValue: categoriesService },
      { provide: Router, useValue: router },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap(paramId ? { id: paramId } : {}) } },
      },
    ],
  });

  return { fixture: TestBed.createComponent(CategoryFormPage), categoriesService, router };
}

describe('CategoryFormPage', () => {
  describe('create mode', () => {
    it('submits the form values and navigates back to the list on success', () => {
      const { fixture, categoriesService, router } = createFixture(null);
      fixture.detectChanges();

      const page = fixture.componentInstance;
      page['form'].setValue({ name: 'Electronics', slug: 'electronics' });
      page['submit']();

      expect(categoriesService.create).toHaveBeenCalledWith({
        name: 'Electronics',
        slug: 'electronics',
      });
      expect(router.navigate).toHaveBeenCalledWith(['/categories']);
    });

    it('does not submit when the form is invalid', () => {
      const { fixture, categoriesService } = createFixture(null);
      fixture.detectChanges();

      fixture.componentInstance['submit']();

      expect(categoriesService.create).not.toHaveBeenCalled();
    });

    it('shows the API-provided message on a duplicate-slug conflict, not a generic error', () => {
      const { fixture, categoriesService } = createFixture(null);
      categoriesService.create.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: {
                message: 'Category with name "Electronics" or slug "electronics" already exists',
              },
            }),
        ),
      );
      fixture.detectChanges();

      const page = fixture.componentInstance;
      page['form'].setValue({ name: 'Electronics', slug: 'electronics' });
      page['submit']();

      expect(page['errorMessage']()).toBe(
        'Category with name "Electronics" or slug "electronics" already exists',
      );
    });
  });

  describe('edit mode', () => {
    it('pre-populates the form from the fetched category list', () => {
      const { fixture, categoriesService } = createFixture('c1');
      fixture.detectChanges();

      expect(categoriesService.list).toHaveBeenCalled();
      const page = fixture.componentInstance;
      expect(page['form'].getRawValue()).toEqual({ name: 'Electronics', slug: 'electronics' });
    });

    it('submits an update for the correct id', () => {
      const { fixture, categoriesService, router } = createFixture('c1');
      fixture.detectChanges();

      const page = fixture.componentInstance;
      page['form'].controls.name.setValue('New name');
      page['submit']();

      expect(categoriesService.update).toHaveBeenCalledWith('c1', {
        name: 'New name',
        slug: 'electronics',
      });
      expect(router.navigate).toHaveBeenCalledWith(['/categories']);
    });

    it('shows an error when the category id is not found in the list', () => {
      const { fixture } = createFixture('missing');
      fixture.detectChanges();

      expect(fixture.componentInstance['errorMessage']()).toContain('Failed to load');
    });
  });
});
