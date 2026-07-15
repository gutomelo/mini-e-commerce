import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import type { ListResponse } from '@mini-e-commerce/types';
import { of, throwError } from 'rxjs';

import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { Category, Product, ProductsService } from '../products.service';
import { ProductListPage } from './product-list-page';

const category: Category = {
  id: 'c1',
  name: 'Electronics',
  slug: 'electronics',
  createdAt: '',
  updatedAt: '',
};

const product: Product = {
  id: 'p1',
  name: 'Widget',
  slug: 'widget',
  description: 'A widget.',
  priceCents: 1999,
  imageUrl: null,
  categoryId: 'c1',
  isActive: true,
  createdAt: '',
  updatedAt: '',
};

function listResponse(products: Product[]): ListResponse<Product> {
  return { data: products, meta: { page: 1, limit: 10, total: products.length, totalPages: 1 } };
}

describe('ProductListPage', () => {
  let fixture: ComponentFixture<ProductListPage>;
  let productsService: {
    listCategories: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    getStock: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let confirmDialogService: { confirm: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    productsService = {
      listCategories: vi.fn().mockReturnValue(of([category])),
      list: vi.fn().mockReturnValue(of(listResponse([product]))),
      getStock: vi.fn().mockReturnValue(of({ productId: 'p1', quantity: 7, updatedAt: '' })),
      delete: vi.fn().mockReturnValue(of(undefined)),
    };
    confirmDialogService = { confirm: vi.fn().mockReturnValue(of(true)) };
    router = { navigate: vi.fn().mockResolvedValue(true) };

    TestBed.configureTestingModule({
      imports: [ProductListPage, NoopAnimationsModule],
      providers: [
        { provide: ProductsService, useValue: productsService },
        { provide: ConfirmDialogService, useValue: confirmDialogService },
        { provide: Router, useValue: router },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    });

    fixture = TestBed.createComponent(ProductListPage);
  });

  function textContent(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('renders a row per product with category name, formatted price, and stock', () => {
    fixture.detectChanges();

    const text = textContent();
    expect(text).toContain('Widget');
    expect(text).toContain('Electronics');
    expect(text).toContain('$19.99');
    expect(text).toContain('7');
  });

  it('navigates to the edit route when a row is clicked', () => {
    fixture.detectChanges();

    const row: HTMLElement = (fixture.nativeElement as HTMLElement).querySelector(
      'tr.data-table-row',
    )!;
    row.click();

    expect(router.navigate).toHaveBeenCalledWith(['/products', 'p1', 'edit']);
  });

  it('navigates to the create route when "New Product" is clicked', () => {
    fixture.detectChanges();

    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
    const newButton = buttons.find((b) => b.textContent?.includes('New Product'));
    newButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(router.navigate).toHaveBeenCalledWith(['/products/new']);
  });

  it('confirms then deletes then refreshes the list on delete', () => {
    fixture.detectChanges();
    productsService.list.mockClear();

    fixture.componentInstance['deleteProduct'](fixture.componentInstance['rows']()[0]);

    expect(confirmDialogService.confirm).toHaveBeenCalled();
    expect(productsService.delete).toHaveBeenCalledWith('p1');
    expect(productsService.list).toHaveBeenCalled();
  });

  it('does not delete when the confirm dialog is cancelled', () => {
    confirmDialogService.confirm.mockReturnValue(of(false));
    fixture.detectChanges();

    fixture.componentInstance['deleteProduct'](fixture.componentInstance['rows']()[0]);

    expect(productsService.delete).not.toHaveBeenCalled();
  });

  it('shows a visible error when delete fails rather than silently ignoring it', () => {
    productsService.delete.mockReturnValue(throwError(() => new Error('boom')));
    fixture.detectChanges();
    const snackBar = TestBed.inject(MatSnackBar);

    fixture.componentInstance['deleteProduct'](fixture.componentInstance['rows']()[0]);

    expect(snackBar.open).toHaveBeenCalled();
  });
});
