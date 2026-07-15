import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';

import { Category, Product, ProductsService, StockInfo } from '../products.service';
import { ProductFormPage } from './product-form-page';

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

const stock: StockInfo = { productId: 'p1', quantity: 7, updatedAt: '' };

function createFixture(paramId: string | null): {
  fixture: ComponentFixture<ProductFormPage>;
  productsService: {
    listCategories: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
    getStock: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    setStock: ReturnType<typeof vi.fn>;
  };
  router: { navigate: ReturnType<typeof vi.fn> };
} {
  const productsService = {
    listCategories: vi.fn().mockReturnValue(of([category])),
    getById: vi.fn().mockReturnValue(of(product)),
    getStock: vi.fn().mockReturnValue(of(stock)),
    create: vi.fn().mockReturnValue(of(product)),
    update: vi.fn().mockReturnValue(of(product)),
    setStock: vi.fn().mockReturnValue(of(stock)),
  };
  const router = { navigate: vi.fn().mockResolvedValue(true) };

  TestBed.configureTestingModule({
    imports: [ProductFormPage, NoopAnimationsModule],
    providers: [
      { provide: ProductsService, useValue: productsService },
      { provide: Router, useValue: router },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap(paramId ? { id: paramId } : {}) } },
      },
    ],
  });

  return { fixture: TestBed.createComponent(ProductFormPage), productsService, router };
}

describe('ProductFormPage', () => {
  describe('create mode', () => {
    it('submits the correct payload converting dollars to integer cents', () => {
      const { fixture, productsService, router } = createFixture(null);
      fixture.detectChanges();

      const page = fixture.componentInstance;
      page['form'].setValue({
        name: 'Widget',
        slug: 'widget',
        description: 'A widget.',
        priceDollars: 19.99,
        imageUrl: '',
        categoryId: 'c1',
      });

      page['submit']();

      expect(productsService.create).toHaveBeenCalledWith({
        name: 'Widget',
        slug: 'widget',
        description: 'A widget.',
        priceCents: 1999,
        imageUrl: undefined,
        categoryId: 'c1',
      });
      expect(router.navigate).toHaveBeenCalledWith(['/products']);
    });

    it('does not submit when the form is invalid', () => {
      const { fixture, productsService } = createFixture(null);
      fixture.detectChanges();

      fixture.componentInstance['submit']();

      expect(productsService.create).not.toHaveBeenCalled();
    });

    it('shows a visible error on a 409 slug conflict', () => {
      const { fixture, productsService } = createFixture(null);
      productsService.create.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'conflict' } })),
      );
      fixture.detectChanges();

      const page = fixture.componentInstance;
      page['form'].setValue({
        name: 'Widget',
        slug: 'widget',
        description: 'A widget.',
        priceDollars: 19.99,
        imageUrl: '',
        categoryId: 'c1',
      });
      page['submit']();

      expect(page['errorMessage']()).toContain('already exists');
    });

    it('does not show the stock card in create mode', () => {
      const { fixture } = createFixture(null);
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Update Stock');
    });
  });

  describe('edit mode', () => {
    it('pre-populates the form from the fetched product and stock', () => {
      const { fixture, productsService } = createFixture('p1');
      fixture.detectChanges();

      expect(productsService.getById).toHaveBeenCalledWith('p1');
      const page = fixture.componentInstance;
      expect(page['form'].getRawValue()).toEqual({
        name: 'Widget',
        slug: 'widget',
        description: 'A widget.',
        priceDollars: 19.99,
        imageUrl: '',
        categoryId: 'c1',
      });
      expect(page['stockControl'].value).toBe(7);
    });

    it('updates stock independently of the main product form save', () => {
      const { fixture, productsService } = createFixture('p1');
      fixture.detectChanges();

      const page = fixture.componentInstance;
      page['stockControl'].setValue(15);
      page['saveStock']();

      expect(productsService.setStock).toHaveBeenCalledWith('p1', 15);
      expect(productsService.update).not.toHaveBeenCalled();
    });

    it('submitting the product form does not touch the stock endpoint', () => {
      const { fixture, productsService } = createFixture('p1');
      fixture.detectChanges();

      fixture.componentInstance['submit']();

      expect(productsService.update).toHaveBeenCalled();
      expect(productsService.setStock).not.toHaveBeenCalled();
    });
  });
});
