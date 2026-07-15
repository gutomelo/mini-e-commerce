/**
 * Resolves the QStash API token used to authenticate outbound publishes.
 * Real deployments always provide `QSTASH_TOKEN` (same Upstash account
 * already used by `apps/inventory`/`apps/payment`); the fallback only
 * exists so the adapter can be constructed in local dev without a real
 * token when it isn't the active `EventPublisher` provider.
 */
export function resolveQStashToken(): string {
  return process.env.QSTASH_TOKEN ?? 'change-me';
}

/** Destination URL for inventory's `order.created` webhook. */
export function resolveInventoryDestinationUrl(): string | undefined {
  return process.env.QSTASH_DESTINATION_URL;
}

/** Destination URL for payment's `order.created` webhook. */
export function resolvePaymentDestinationUrl(): string | undefined {
  return process.env.PAYMENT_QSTASH_DESTINATION_URL;
}
