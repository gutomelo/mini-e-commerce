import {
  NewOrder,
  Order,
  OrderListFilter,
  OrderListResult,
  OrderStatus,
} from '../../../domain/orders/order.entity';

/**
 * Abstracts order persistence. Use cases depend only on this interface;
 * `PrismaOrderRepository` (infrastructure layer) is the concrete adapter.
 *
 * Every read here is scoped to a `userId` at the query level — a customer
 * must never be able to reach another customer's order through this port,
 * so `list`/`findByIdForUser` filter by `userId` in the underlying query
 * rather than relying on application-layer filtering.
 */
export abstract class OrderRepository {
  /** Persists the order and its line items atomically. */
  abstract create(order: NewOrder): Promise<Order>;
  /** Paginated, newest-first, scoped to `userId`. */
  abstract list(userId: string, filter: OrderListFilter): Promise<OrderListResult>;
  /** Returns `null` (not the order) when `id` exists but belongs to a different user. */
  abstract findByIdForUser(id: string, userId: string): Promise<Order | null>;
  /**
   * Returns the order by id, unscoped by `userId`.
   *
   * This is the one deliberate exception to the "every read is scoped to a
   * `userId`" rule stated above. It exists for the QStash payment-event
   * webhook consumer (`HandlePaymentEventUseCase`, a later task), which has
   * no authenticated-user context — it only learns an `orderId` from an
   * inbound `payment.completed`/`payment.failed` event payload, not a user
   * session. Do not reuse this method for any user-facing endpoint; use
   * `findByIdForUser` there instead.
   */
  abstract findById(id: string): Promise<Order | null>;
  /** Updates only the order's status; `updatedAt` is bumped by Prisma's `@updatedAt`. */
  abstract updateStatus(id: string, status: OrderStatus): Promise<Order>;
}
