import { Injectable, inject } from '@angular/core';
import type { ListResponse, SingleResponse } from '@mini-e-commerce/types';
import { Observable, map } from 'rxjs';

import { ApiClient } from '../../core/http/api-client';

/** The three statuses an order can be in (see `apps/api`'s `OrderStatus`). */
export type OrderStatus = 'PLACED' | 'PAID' | 'PAYMENT_FAILED';

/** Shape returned by `GET /admin/orders` (see `apps/api`'s `AdminOrderSummaryOutput`). */
export interface AdminOrderSummary {
  readonly id: string;
  readonly status: OrderStatus;
  readonly totalCents: number;
  readonly itemCount: number;
  readonly createdAt: string;
  readonly userId: string;
  readonly userEmail: string;
}

/** A single line item within `GET /admin/orders/:id` (see `apps/api`'s `OrderOutput` items). */
export interface AdminOrderItem {
  readonly productId: string;
  readonly productName: string;
  readonly unitPriceCents: number;
  readonly quantity: number;
}

/** Shape returned by `GET /admin/orders/:id` (see `apps/api`'s `AdminOrderOutput`). */
export interface AdminOrder {
  readonly id: string;
  readonly status: OrderStatus;
  readonly totalCents: number;
  readonly items: readonly AdminOrderItem[];
  readonly createdAt: string;
  readonly userId: string;
  readonly userEmail: string;
}

/** Query parameters accepted by `GET /admin/orders`. */
export interface ListOrdersParams {
  page?: number;
  limit?: number;
  status?: OrderStatus;
}

/**
 * Feature-level service wrapping every HTTP call the read-only orders
 * screens need: the cross-customer order list (optionally filtered by
 * status) and a single order's detail with line items. There is
 * deliberately no method to mutate an order here — status stays exclusively
 * controlled by the Phase 6 event-driven backend flow, per the spec's
 * "Order management (view-only)" goal.
 */
@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly apiClient = inject(ApiClient);

  list(params: ListOrdersParams = {}): Observable<ListResponse<AdminOrderSummary>> {
    const query: Record<string, string | number> = {};
    if (params.page !== undefined) {
      query['page'] = params.page;
    }
    if (params.limit !== undefined) {
      query['limit'] = params.limit;
    }
    if (params.status) {
      query['status'] = params.status;
    }
    return this.apiClient.get<ListResponse<AdminOrderSummary>>('/admin/orders', query);
  }

  getById(id: string): Observable<AdminOrder> {
    return this.apiClient
      .get<SingleResponse<AdminOrder>>(`/admin/orders/${id}`)
      .pipe(map((response) => response.data));
  }
}
