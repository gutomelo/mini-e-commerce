import type { EventName } from '@mini-e-commerce/types';

/**
 * Application-layer port for publishing domain events (e.g. `order.created`)
 * to every interested downstream service. Use cases depend only on this
 * interface so business logic stays framework- and transport-agnostic.
 *
 * Implementations are expected to be best-effort: a publish failure must be
 * logged by the implementation and never rethrown, so a downstream/broker
 * outage never fails the use case that triggered the event.
 */
export abstract class EventPublisher {
  abstract publish<TData>(event: EventName, correlationId: string, data: TData): Promise<void>;
}
