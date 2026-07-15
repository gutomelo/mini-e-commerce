import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { ListResponse, SingleResponse } from '@mini-e-commerce/types';

import { Product, ProductsService, StockInfo } from './products.service';

const product: Product = {
  id: 'p1',
  name: 'Widget',
  slug: 'widget',
  description: 'A widget.',
  priceCents: 1999,
  imageUrl: null,
  categoryId: 'c1',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('ProductsService', () => {
  let service: ProductsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProductsService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProductsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list() sends search as a query param and returns the list envelope', () => {
    let result: ListResponse<Product> | undefined;
    service.list({ page: 2, limit: 10, search: 'widget' }).subscribe((r) => (result = r));

    const req = httpMock.expectOne(
      (r) =>
        r.url === '/api/v1/products' &&
        r.params.get('page') === '2' &&
        r.params.get('limit') === '10' &&
        r.params.get('search') === 'widget',
    );
    req.flush({
      data: [product],
      meta: { page: 2, limit: 10, total: 1, totalPages: 1 },
    } satisfies ListResponse<Product>);

    expect(result?.data).toEqual([product]);
  });

  it('getById() unwraps the single-response envelope', () => {
    let result: Product | undefined;
    service.getById('p1').subscribe((r) => (result = r));

    httpMock
      .expectOne('/api/v1/products/p1')
      .flush({ data: product } satisfies SingleResponse<Product>);

    expect(result).toEqual(product);
  });

  it('create() posts the input and returns the created product', () => {
    let result: Product | undefined;
    service
      .create({
        name: 'Widget',
        slug: 'widget',
        description: 'A widget.',
        priceCents: 1999,
        categoryId: 'c1',
      })
      .subscribe((r) => (result = r));

    const req = httpMock.expectOne('/api/v1/products');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      name: 'Widget',
      slug: 'widget',
      description: 'A widget.',
      priceCents: 1999,
      categoryId: 'c1',
    });
    req.flush({ data: product } satisfies SingleResponse<Product>);

    expect(result).toEqual(product);
  });

  it('update() patches the given id', () => {
    service.update('p1', { name: 'New name' }).subscribe();

    const req = httpMock.expectOne('/api/v1/products/p1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'New name' });
    req.flush({ data: product } satisfies SingleResponse<Product>);
  });

  it('delete() sends a DELETE request', () => {
    service.delete('p1').subscribe();

    const req = httpMock.expectOne('/api/v1/products/p1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('getStock() resolves to null (not an error) on a 404', () => {
    let result: StockInfo | null | undefined;
    service.getStock('p1').subscribe((r) => (result = r));

    httpMock
      .expectOne('/api/v1/admin/inventory/p1')
      .flush({ message: 'not found' }, { status: 404, statusText: 'Not Found' });

    expect(result).toBeNull();
  });

  it('getStock() resolves to the stock info on success', () => {
    const stock: StockInfo = {
      productId: 'p1',
      quantity: 5,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    let result: StockInfo | null | undefined;
    service.getStock('p1').subscribe((r) => (result = r));

    httpMock
      .expectOne('/api/v1/admin/inventory/p1')
      .flush({ data: stock } satisfies SingleResponse<StockInfo>);

    expect(result).toEqual(stock);
  });

  it('setStock() patches the quantity', () => {
    const stock: StockInfo = {
      productId: 'p1',
      quantity: 8,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    let result: StockInfo | undefined;
    service.setStock('p1', 8).subscribe((r) => (result = r));

    const req = httpMock.expectOne('/api/v1/admin/inventory/p1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ quantity: 8 });
    req.flush({ data: stock } satisfies SingleResponse<StockInfo>);

    expect(result).toEqual(stock);
  });

  it('listCategories() unwraps the list envelope into a plain array', () => {
    let result: unknown;
    service.listCategories().subscribe((r) => (result = r));

    httpMock.expectOne('/api/v1/categories').flush({
      data: [{ id: 'c1', name: 'Electronics', slug: 'electronics', createdAt: '', updatedAt: '' }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    expect(result).toEqual([
      { id: 'c1', name: 'Electronics', slug: 'electronics', createdAt: '', updatedAt: '' },
    ]);
  });
});
