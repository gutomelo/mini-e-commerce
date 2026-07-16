import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';

import { AdminOrder, AdminOrderItem, OrdersService } from '../orders.service';
import { statusBadgeClass } from '../status-badge.util';

/** A line item row plus its derived subtotal display. */
interface ItemRow extends AdminOrderItem {
  readonly unitPriceDisplay: string;
  readonly subtotalDisplay: string;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * `/orders/:id` route: read-only detail view of a single order (any
 * customer's), including its line items. No editing/status-change control
 * exists on this page — per the spec, order status is exclusively driven by
 * the Phase 6 event-driven backend flow. A `404` (unknown or deleted order
 * id) renders a clear "not found" state rather than a blank page or an
 * unhandled error.
 */
@Component({
  selector: 'app-order-detail-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
  ],
  templateUrl: './order-detail-page.html',
  styleUrl: './order-detail-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetailPage implements OnInit {
  private readonly ordersService = inject(OrdersService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly order = signal<AdminOrder | null>(null);
  protected readonly itemRows = signal<readonly ItemRow[]>([]);

  protected readonly itemColumns = [
    'productName',
    'unitPriceDisplay',
    'quantity',
    'subtotalDisplay',
  ];

  protected readonly totalDisplay = computed(() => {
    const order = this.order();
    return order ? formatCents(order.totalCents) : '';
  });

  protected readonly createdDisplay = computed(() => {
    const order = this.order();
    return order ? new Date(order.createdAt).toLocaleString() : '';
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigate(['/orders']);
      return;
    }

    this.loading.set(true);
    this.ordersService
      .getById(id)
      .pipe(
        catchError((error: unknown) => {
          if (this.isNotFound(error)) {
            this.notFound.set(true);
          } else {
            this.errorMessage.set('Failed to load the order. Please try again.');
          }
          return of(null);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe((order) => {
        if (!order) {
          return;
        }
        this.order.set(order);
        this.itemRows.set(order.items.map((item) => this.toItemRow(item)));
      });
  }

  protected statusClass(): string {
    const order = this.order();
    return order ? statusBadgeClass(order.status) : '';
  }

  private toItemRow(item: AdminOrderItem): ItemRow {
    return {
      ...item,
      unitPriceDisplay: formatCents(item.unitPriceCents),
      subtotalDisplay: formatCents(item.unitPriceCents * item.quantity),
    };
  }

  private isNotFound(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      (error as { status: unknown }).status === 404
    );
  }
}
