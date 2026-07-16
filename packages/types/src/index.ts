export * from './api.js';

/**
 * Canonical event names published through QStash.
 * Every service must reference these constants instead of raw strings.
 */
export const EVENT_NAMES = {
  ORDER_CREATED: 'order.created',
  INVENTORY_UPDATED: 'inventory.updated',
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  PRODUCT_UPDATED: 'product.updated',
} as const;

export type EventName = (typeof EVENT_NAMES)[keyof typeof EVENT_NAMES];

/**
 * Standard envelope for every event exchanged between services.
 */
export interface EventEnvelope<TData> {
  event: EventName;
  correlationId: string;
  timestamp: string;
  data: TData;
}
