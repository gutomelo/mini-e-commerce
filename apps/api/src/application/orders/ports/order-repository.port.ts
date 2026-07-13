import {
  NewOrder,
  Order,
  OrderListFilter,
  OrderListResult,
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
}
