import {
  AdminOrderListFilter,
  AdminOrderListResult,
  NewOrder,
  Order,
  OrderListFilter,
  OrderListResult,
  OrderStatus,
  OrderWithCustomer,
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

  /**
   * Paginated, newest-first, across every customer, optionally filtered by
   * `status`. Joins `User` for `userEmail`.
   *
   * This is the second deliberate exception to the "every read is scoped to
   * a `userId`" rule stated above (the first being `findById`). It exists
   * only for the ADMIN-only order-review screens added in Phase 7 — reachable
   * exclusively from routes behind `RolesGuard` + `@Roles(ADMIN)`. Do not
   * reuse this method for any customer-facing endpoint; use `list` there
   * instead.
   */
  abstract listAll(filter: AdminOrderListFilter): Promise<AdminOrderListResult>;

  /**
   * Returns the order by id, unscoped by `userId`, joined with the owning
   * user for `userEmail`. The third deliberate exception to the port's usual
   * `userId`-scoping, alongside `findById` and `listAll` above.
   *
   * `findById` already returns everything the QStash payment-event consumer
   * needs (it never displays a customer identity), so it was left
   * unchanged; this method exists specifically for the ADMIN order-detail
   * view, which does need `userEmail` to identify the owning customer. Do
   * not reuse this method for any customer-facing endpoint; use
   * `findByIdForUser` there instead.
   */
  abstract findByIdWithUser(id: string): Promise<OrderWithCustomer | null>;
}
