import { randomUUID } from 'node:crypto';

import type { EventEnvelope, EventName } from '@mini-e-commerce/types';

/**
 * Generates a correlation id used to trace a request across services.
 */
export function newCorrelationId(): string {
  return randomUUID();
}

/**
 * Builds the standard event envelope published to QStash.
 * Reuse the incoming correlation id when the event belongs to an existing trace.
 */
export function createEventEnvelope<TData>(
  event: EventName,
  data: TData,
  correlationId: string = newCorrelationId(),
): EventEnvelope<TData> {
  return {
    event,
    correlationId,
    timestamp: new Date().toISOString(),
    data,
  };
}
