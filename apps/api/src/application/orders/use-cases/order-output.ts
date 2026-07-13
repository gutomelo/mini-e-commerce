import { Order } from '../../../domain/orders/order.entity';

/** Line item shape returned to the presentation layer as part of `OrderOutput`. */
export interface OrderItemOutput {
  productId: string;
  productName: string;
  unitPriceCents: number;
  quantity: number;
}

/** Full order shape returned by `CreateOrderUseCase`/`GetOrderUseCase`. */
export interface OrderOutput {
  id: string;
  status: string;
  totalCents: number;
  items: OrderItemOutput[];
  createdAt: Date;
}

/** Condensed shape returned by `ListOrdersUseCase` (no line items, just a count). */
export interface OrderSummaryOutput {
  id: string;
  status: string;
  totalCents: number;
  itemCount: number;
  createdAt: Date;
}

export function toOrderOutput(order: Order): OrderOutput {
  return {
    id: order.id,
    status: order.status,
    totalCents: order.totalCents,
    items: order.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
    })),
    createdAt: order.createdAt,
  };
}

export function toOrderSummaryOutput(order: Order): OrderSummaryOutput {
  return {
    id: order.id,
    status: order.status,
    totalCents: order.totalCents,
    itemCount: order.items.length,
    createdAt: order.createdAt,
  };
}
