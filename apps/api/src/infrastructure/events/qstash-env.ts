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

/**
 * Current QStash signing key, used by {@link QStashSignatureVerifier} to
 * validate the `Upstash-Signature` header on inbound webhook requests.
 * Undefined in local dev when the verifier isn't exercised against real
 * Upstash traffic.
 */
export function resolveCurrentSigningKey(): string | undefined {
  return process.env.QSTASH_CURRENT_SIGNING_KEY;
}

/**
 * Next QStash signing key (accepted alongside the current one so a key
 * rotation doesn't reject in-flight deliveries signed with the previous key).
 */
export function resolveNextSigningKey(): string | undefined {
  return process.env.QSTASH_NEXT_SIGNING_KEY;
}

/**
 * The external URL QStash was told to deliver `apps/api`'s own webhook to.
 * Passed to {@link QStashSignatureVerifier} so it checks the signed
 * request's `url` claim matches, exactly like `apps/inventory`/
 * `apps/payment`'s own consumers. Undefined disables the URL check
 * (falls back to signature-only verification) rather than rejecting
 * every request in local dev, where this var may be unset.
 */
export function resolveApiDestinationUrl(): string | undefined {
  return process.env.API_QSTASH_DESTINATION_URL;
}
