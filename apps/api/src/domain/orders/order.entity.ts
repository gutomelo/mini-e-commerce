/**
 * Domain representation of a customer order. Intentionally decoupled from
 * the generated Prisma model so application/domain code has no framework or
 * ORM dependency — infrastructure repositories are responsible for mapping
 * between this shape and persistence.
 *
 * `unitPriceCents`/`totalCents` store price as an integer in the smallest
 * currency unit (cents), matching `Product.priceCents`, to avoid
 * floating-point rounding issues.
 */

/**
 * Order lifecycle status. `PLACED` is the initial state; `PAID`/`PAYMENT_FAILED`
 * are set by the QStash consumer reacting to `payment.completed`/`payment.failed`
 * (Phase 6). `inventory.updated` has no bearing on order status.
 */
export type OrderStatus = 'PLACED' | 'PAID' | 'PAYMENT_FAILED';

export interface OrderItem {
  readonly id: string;
  readonly productId: string;
  /** Snapshot of `Product.name` at order time — historical, not live. */
  readonly productName: string;
  /** Snapshot of `Product.priceCents` at order time — historical, not live. */
  readonly unitPriceCents: number;
  readonly quantity: number;
}

export interface Order {
  readonly id: string;
  readonly userId: string;
  readonly status: OrderStatus;
  readonly totalCents: number;
  readonly items: OrderItem[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** A single requested line item, before re-pricing/snapshotting. */
export interface NewOrderItem {
  productId: string;
  productName: string;
  unitPriceCents: number;
  quantity: number;
}

/** Fields required to persist a new order; id/status/timestamps are assigned by persistence. */
export interface NewOrder {
  userId: string;
  totalCents: number;
  items: NewOrderItem[];
}

/** Normalized, validated filter used by `OrderRepository.list`. */
export interface OrderListFilter {
  page: number;
  limit: number;
}

/** Result of a paginated order list query. */
export interface OrderListResult {
  items: Order[];
  total: number;
}
