import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import type { ListResponse } from '@mini-e-commerce/types';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import { ApiClient } from '../../../core/http/api-client';

/**
 * The only three valid `OrderStatus` values the backend defines (see
 * `apps/api/src/domain/orders/order.entity.ts`). Hardcoded here rather than
 * imported, since `apps/admin` must never depend on `apps/api` internals —
 * the frontend only ever talks to the NestJS API over HTTP.
 */
const ORDER_STATUSES = ['PLACED', 'PAID', 'PAYMENT_FAILED'] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PLACED: 'Placed',
  PAID: 'Paid',
  PAYMENT_FAILED: 'Payment Failed',
};

interface DashboardStats {
  readonly totalProducts: number;
  readonly totalCategories: number;
  readonly totalOrders: number;
  readonly ordersByStatus: Readonly<Record<OrderStatus, number>>;
}

/** Sentinel returned by the stats pipeline's `catchError` so the subscriber can
 * distinguish "one of the parallel calls failed" (error message already set)
 * from "all calls succeeded" (the aggregated `DashboardStats`). */
const STATS_LOAD_FAILED = Symbol('dashboard-stats-load-failed');

/**
 * `/` dashboard route (behind `admin.guard`): aggregate counts only, derived
 * client-side from existing list endpoints' `meta.total` — total products,
 * total categories, total orders, and a per-status order breakdown. No new
 * backend aggregation endpoint is involved; each count comes from a `limit=1`
 * list call fired in parallel via `forkJoin`, reading only `meta.total`.
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [MatCardModule, MatProgressSpinnerModule, MatButtonModule],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage implements OnInit {
  private readonly apiClient = inject(ApiClient);

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly stats = signal<DashboardStats | null>(null);

  protected readonly orderStatuses = ORDER_STATUSES;
  protected readonly orderStatusLabels = ORDER_STATUS_LABELS;

  ngOnInit(): void {
    this.loadStats();
  }

  protected retry(): void {
    this.loadStats();
  }

  private loadStats(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    forkJoin({
      products: this.apiClient.get<ListResponse<unknown>>('/products', { limit: 1 }),
      categories: this.apiClient.get<ListResponse<unknown>>('/categories'),
      orders: this.apiClient.get<ListResponse<unknown>>('/admin/orders', { limit: 1 }),
      placed: this.apiClient.get<ListResponse<unknown>>('/admin/orders', {
        status: 'PLACED',
        limit: 1,
      }),
      paid: this.apiClient.get<ListResponse<unknown>>('/admin/orders', {
        status: 'PAID',
        limit: 1,
      }),
      paymentFailed: this.apiClient.get<ListResponse<unknown>>('/admin/orders', {
        status: 'PAYMENT_FAILED',
        limit: 1,
      }),
    })
      .pipe(
        catchError(() => {
          this.errorMessage.set('Failed to load dashboard stats. Please try again.');
          return of(STATS_LOAD_FAILED);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe((result) => {
        if (result === STATS_LOAD_FAILED) {
          return;
        }

        this.stats.set({
          totalProducts: result.products.meta.total,
          totalCategories: result.categories.meta.total,
          totalOrders: result.orders.meta.total,
          ordersByStatus: {
            PLACED: result.placed.meta.total,
            PAID: result.paid.meta.total,
            PAYMENT_FAILED: result.paymentFailed.meta.total,
          },
        });
      });
  }
}
