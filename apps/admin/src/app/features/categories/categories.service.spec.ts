import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { ListResponse, SingleResponse } from '@mini-e-commerce/types';

import { Category, CategoriesService } from './categories.service';

const category: Category = {
  id: 'c1',
  name: 'Electronics',
  slug: 'electronics',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('CategoriesService', () => {
  let service: CategoriesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CategoriesService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CategoriesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list() returns the list envelope', () => {
    let result: ListResponse<Category> | undefined;
    service.list().subscribe((r) => (result = r));

    const req = httpMock.expectOne('/api/v1/categories');
    expect(req.request.method).toBe('GET');
    req.flush({
      data: [category],
      meta: { page: 1, limit: 1, total: 1, totalPages: 1 },
    } satisfies ListResponse<Category>);

    expect(result?.data).toEqual([category]);
  });

  it('create() posts the input and returns the created category', () => {
    let result: Category | undefined;
    service.create({ name: 'Electronics', slug: 'electronics' }).subscribe((r) => (result = r));

    const req = httpMock.expectOne('/api/v1/categories');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Electronics', slug: 'electronics' });
    req.flush({ data: category } satisfies SingleResponse<Category>);

    expect(result).toEqual(category);
  });

  it('update() patches the given id', () => {
    service.update('c1', { name: 'New name' }).subscribe();

    const req = httpMock.expectOne('/api/v1/categories/c1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'New name' });
    req.flush({ data: category } satisfies SingleResponse<Category>);
  });

  it('delete() sends a DELETE request', () => {
    service.delete('c1').subscribe();

    const req = httpMock.expectOne('/api/v1/categories/c1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
