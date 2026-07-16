import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  TemplateRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { PageEvent } from '@angular/material/paginator';
import { Router } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';

import { DataTable, DataTableColumn } from '../../../shared/components/data-table/data-table';
import { AdminOrderSummary, OrderStatus, OrdersService } from '../orders.service';
import { statusBadgeClass } from '../status-badge.util';

/** Status filter options: the three valid statuses plus an "All" sentinel. */
type StatusFilter = OrderStatus | 'ALL';

/** Row shape rendered by `DataTable`: the raw order summary plus derived display fields. */
interface OrderRow extends AdminOrderSummary {
  readonly idDisplay: string;
  readonly totalDisplay: string;
  readonly createdDisplay: string;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function shortenId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

/**
 * `/orders` route: paginated, status-filterable, read-only list of orders
 * across every customer. Row click navigates to `/orders/:id`. Deliberately
 * has no create/edit/delete affordance anywhere — this feature is view-only
 * per the spec, since order status stays exclusively controlled by the
 * Phase 6 event-driven backend flow.
 */
@Component({
  selector: 'app-order-list-page',
  imports: [
    DataTable,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
  ],
  templateUrl: './order-list-page.html',
  styleUrl: './order-list-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderListPage implements OnInit {
  private readonly ordersService = inject(OrdersService);
  private readonly router = inject(Router);

  private readonly statusTemplate =
    viewChild.required<TemplateRef<{ $implicit: OrderRow }>>('statusCell');

  protected readonly statusControl = new FormControl<StatusFilter>('ALL', { nonNullable: true });

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly rows = signal<readonly OrderRow[]>([]);
  protected readonly total = signal(0);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(10);

  protected get columns(): readonly DataTableColumn<OrderRow>[] {
    return [
      { key: 'idDisplay', label: 'Order' },
      { key: 'userEmail', label: 'Customer' },
      { key: 'totalDisplay', label: 'Total' },
      { key: 'itemCount', label: 'Items' },
      { key: 'status', label: 'Status', cellTemplate: this.statusTemplate() },
      { key: 'createdDisplay', label: 'Created' },
    ];
  }

  ngOnInit(): void {
    this.loadOrders();

    this.statusControl.valueChanges.subscribe(() => {
      this.pageIndex.set(0);
      this.loadOrders();
    });
  }

  protected onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadOrders();
  }

  protected viewOrder(row: OrderRow): void {
    void this.router.navigate(['/orders', row.id]);
  }

  protected statusClass(status: OrderStatus): string {
    return statusBadgeClass(status);
  }

  private loadOrders(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    const status = this.statusControl.value;

    this.ordersService
      .list({
        page: this.pageIndex() + 1,
        limit: this.pageSize(),
        status: status === 'ALL' ? undefined : status,
      })
      .pipe(
        catchError(() => {
          this.errorMessage.set('Failed to load orders. Please try again.');
          return of(null);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe((response) => {
        if (!response) {
          return;
        }
        this.total.set(response.meta.total);
        this.rows.set(response.data.map((order) => this.toRow(order)));
      });
  }

  private toRow(order: AdminOrderSummary): OrderRow {
    return {
      ...order,
      idDisplay: shortenId(order.id),
      totalDisplay: formatCents(order.totalCents),
      createdDisplay: new Date(order.createdAt).toLocaleString(),
    };
  }
}
