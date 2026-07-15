import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import type { ListResponse } from '@mini-e-commerce/types';
import { of, throwError } from 'rxjs';

import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { Category, CategoriesService } from '../categories.service';
import { CategoryListPage } from './category-list-page';

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

describe('CategoryListPage', () => {
  let fixture: ComponentFixture<CategoryListPage>;
  let categoriesService: {
    list: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let confirmDialogService: { confirm: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    categoriesService = {
      list: vi.fn().mockReturnValue(of(listResponse([category]))),
      delete: vi.fn().mockReturnValue(of(undefined)),
    };
    confirmDialogService = { confirm: vi.fn().mockReturnValue(of(true)) };
    router = { navigate: vi.fn().mockResolvedValue(true) };

    TestBed.configureTestingModule({
      imports: [CategoryListPage, NoopAnimationsModule],
      providers: [
        { provide: CategoriesService, useValue: categoriesService },
        { provide: ConfirmDialogService, useValue: confirmDialogService },
        { provide: Router, useValue: router },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    });

    fixture = TestBed.createComponent(CategoryListPage);
  });

  function textContent(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('renders a row per category with name and slug', () => {
    fixture.detectChanges();

    const text = textContent();
    expect(text).toContain('Electronics');
    expect(text).toContain('electronics');
  });

  it('navigates to the edit route when a row is clicked', () => {
    fixture.detectChanges();

    const row: HTMLElement = (fixture.nativeElement as HTMLElement).querySelector(
      'tr.data-table-row',
    )!;
    row.click();

    expect(router.navigate).toHaveBeenCalledWith(['/categories', 'c1', 'edit']);
  });

  it('navigates to the create route when "New Category" is clicked', () => {
    fixture.detectChanges();

    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
    const newButton = buttons.find((b) => b.textContent?.includes('New Category'));
    newButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(router.navigate).toHaveBeenCalledWith(['/categories/new']);
  });

  it('confirms then deletes then refreshes the list on delete', () => {
    fixture.detectChanges();
    categoriesService.list.mockClear();

    fixture.componentInstance['deleteCategory'](fixture.componentInstance['rows']()[0]);

    expect(confirmDialogService.confirm).toHaveBeenCalled();
    expect(categoriesService.delete).toHaveBeenCalledWith('c1');
    expect(categoriesService.list).toHaveBeenCalled();
  });

  it('does not delete when the confirm dialog is cancelled', () => {
    confirmDialogService.confirm.mockReturnValue(of(false));
    fixture.detectChanges();

    fixture.componentInstance['deleteCategory'](fixture.componentInstance['rows']()[0]);

    expect(categoriesService.delete).not.toHaveBeenCalled();
  });

  it('shows the API-provided message for a 409 (category still has products), not a generic error', () => {
    categoriesService.delete.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: {
              message: 'Category "Electronics" has 3 associated product(s) and cannot be deleted',
            },
          }),
      ),
    );
    fixture.detectChanges();
    const snackBar = TestBed.inject(MatSnackBar);

    fixture.componentInstance['deleteCategory'](fixture.componentInstance['rows']()[0]);

    expect(snackBar.open).toHaveBeenCalledWith(
      'Category "Electronics" has 3 associated product(s) and cannot be deleted',
      'Dismiss',
      { duration: 8000 },
    );
  });

  it('shows a generic error when the delete failure has no message', () => {
    categoriesService.delete.mockReturnValue(throwError(() => new Error('boom')));
    fixture.detectChanges();
    const snackBar = TestBed.inject(MatSnackBar);

    fixture.componentInstance['deleteCategory'](fixture.componentInstance['rows']()[0]);

    expect(snackBar.open).toHaveBeenCalledWith(
      'Failed to delete the category. Please try again.',
      'Dismiss',
      { duration: 8000 },
    );
  });
});
