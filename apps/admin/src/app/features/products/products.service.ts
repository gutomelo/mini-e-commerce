import { Injectable, inject } from '@angular/core';
import type { ListResponse, SingleResponse } from '@mini-e-commerce/types';
import { Observable, catchError, map, of } from 'rxjs';

import { ApiClient } from '../../core/http/api-client';

/** Shape returned by `GET /products` / `GET /products/:idOrSlug` (see `apps/api`'s `ProductOutput`). */
export interface Product {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  readonly priceCents: number;
  readonly imageUrl: string | null;
  readonly categoryId: string;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Shape returned by `GET /categories` (see `apps/api`'s `CategoryOutput`). */
export interface Category {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Fields accepted by `POST /products` / `PATCH /products/:id`; all optional on update. */
export interface ProductInput {
  name?: string;
  slug?: string;
  description?: string;
  priceCents?: number;
  imageUrl?: string;
  categoryId?: string;
}

/** Query parameters accepted by `GET /products`. Only `search` is wired to UI in this task. */
export interface ListProductsParams {
  page?: number;
  limit?: number;
  search?: string;
}

/** Shape returned by `GET`/`PATCH /admin/inventory/:productId`. */
export interface StockInfo {
  readonly productId: string;
  readonly quantity: number;
  readonly updatedAt: string;
}

/**
 * Feature-level service wrapping every HTTP call the products screens need:
 * product CRUD, the category list (for the create/edit form's dropdown), and
 * the stock read/write proxy (`/admin/inventory/:productId`). Kept here
 * rather than split into a separate categories service since categories are
 * only read (never mutated) from this feature — the categories feature
 * (a later task) owns full category CRUD.
 *
 * Components consuming this service stay presentation-only, per this
 * project's Angular rules.
 */
@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly apiClient = inject(ApiClient);

  list(params: ListProductsParams = {}): Observable<ListResponse<Product>> {
    const query: Record<string, string | number> = {};
    if (params.page !== undefined) {
      query['page'] = params.page;
    }
    if (params.limit !== undefined) {
      query['limit'] = params.limit;
    }
    if (params.search) {
      query['search'] = params.search;
    }
    return this.apiClient.get<ListResponse<Product>>('/products', query);
  }

  getById(id: string): Observable<Product> {
    return this.apiClient
      .get<SingleResponse<Product>>(`/products/${id}`)
      .pipe(map((response) => response.data));
  }

  create(input: ProductInput): Observable<Product> {
    return this.apiClient
      .post<SingleResponse<Product>>('/products', input)
      .pipe(map((response) => response.data));
  }

  update(id: string, input: ProductInput): Observable<Product> {
    return this.apiClient
      .patch<SingleResponse<Product>>(`/products/${id}`, input)
      .pipe(map((response) => response.data));
  }

  delete(id: string): Observable<void> {
    return this.apiClient.delete<void>(`/products/${id}`);
  }

  listCategories(): Observable<Category[]> {
    return this.apiClient
      .get<ListResponse<Category>>('/categories')
      .pipe(map((response) => response.data));
  }

  /**
   * Looks up a product's stock quantity. A `404` means no stock row exists
   * yet for that product — a legitimate state, not an error — so it resolves
   * to `null` rather than propagating the HTTP error.
   */
  getStock(productId: string): Observable<StockInfo | null> {
    return this.apiClient.get<SingleResponse<StockInfo>>(`/admin/inventory/${productId}`).pipe(
      map((response) => response.data),
      catchError(() => of(null)),
    );
  }

  setStock(productId: string, quantity: number): Observable<StockInfo> {
    return this.apiClient
      .patch<SingleResponse<StockInfo>>(`/admin/inventory/${productId}`, { quantity })
      .pipe(map((response) => response.data));
  }
}
