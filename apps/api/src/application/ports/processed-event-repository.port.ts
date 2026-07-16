/**
 * Application-layer port guarding idempotent processing of inbound events
 * (e.g. `payment.completed`/`payment.failed`) delivered via QStash webhooks.
 *
 * A `(correlationId, event)` pair is claimed atomically before any business
 * logic runs, so a redelivery of the identical event is a silent no-op
 * rather than a duplicate/conflicting status change.
 */
export abstract class ProcessedEventRepository {
  /** Atomically claims (correlationId, event); returns true only for the caller that wins the race. */
  abstract tryClaim(correlationId: string, event: string): Promise<boolean>;
}
