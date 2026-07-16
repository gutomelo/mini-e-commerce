import { Injectable, inject } from '@angular/core';
import type { ListResponse, SingleResponse } from '@mini-e-commerce/types';
import { Observable, map } from 'rxjs';

import { ApiClient } from '../../core/http/api-client';

/** Shape returned by `GET /categories` (see `apps/api`'s `CategoryOutput`). */
export interface Category {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Fields accepted by `POST /categories` / `PATCH /categories/:id`; both optional on update. */
export interface CategoryInput {
  name?: string;
  slug?: string;
}

/**
 * Feature-level service wrapping every HTTP call the categories screens
 * need. `apps/api` exposes no `GET /categories/:id` endpoint — only
 * `list`/`create`/`update`/`delete` (see `apps/api/src/presentation/
 * categories/categories.controller.ts`) — and the list is small and
 * unpaginated (`meta.total` reflects the full count), so there is no
 * `getById` here: the edit form fetches the full list and finds the
 * matching row in memory rather than adding a network round trip the
 * backend doesn't support anyway.
 *
 * Components consuming this service stay presentation-only, per this
 * project's Angular rules.
 */
@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly apiClient = inject(ApiClient);

  list(): Observable<ListResponse<Category>> {
    return this.apiClient.get<ListResponse<Category>>('/categories');
  }

  create(input: CategoryInput): Observable<Category> {
    return this.apiClient
      .post<SingleResponse<Category>>('/categories', input)
      .pipe(map((response) => response.data));
  }

  update(id: string, input: CategoryInput): Observable<Category> {
    return this.apiClient
      .patch<SingleResponse<Category>>(`/categories/${id}`, input)
      .pipe(map((response) => response.data));
  }

  delete(id: string): Observable<void> {
    return this.apiClient.delete<void>(`/categories/${id}`);
  }
}
