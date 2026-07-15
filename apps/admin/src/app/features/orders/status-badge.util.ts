import { OrderStatus } from './orders.service';

/**
 * Maps an order status to the CSS class rendering its colored chip. Shared
 * between `OrderListPage` and `OrderDetailPage` so the two screens stay
 * visually consistent and the mapping isn't duplicated. Pairs with the
 * `.status-chip*` classes each page pulls in from `./status-badge.scss`.
 */
export function statusBadgeClass(status: OrderStatus): string {
  switch (status) {
    case 'PAID':
      return 'status-chip status-chip--success';
    case 'PAYMENT_FAILED':
      return 'status-chip status-chip--warn';
    case 'PLACED':
    default:
      return 'status-chip status-chip--neutral';
  }
}
