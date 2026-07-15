/**
 * Base URL of `apps/inventory`'s internal REST surface (e.g.
 * `http://inventory:8081` in compose). Falls back to `localhost:8081` so
 * the adapter can be constructed in local dev without a running compose
 * stack when it isn't actually exercised.
 */
export function resolveInventoryBaseUrl(): string {
  return process.env.INVENTORY_BASE_URL ?? 'http://localhost:8081';
}

/**
 * Shared secret sent as `X-Internal-Api-Key` on every call to
 * `apps/inventory`. Must match the `INTERNAL_API_KEY` value `apps/inventory`
 * itself was started with.
 */
export function resolveInventoryInternalApiKey(): string {
  return process.env.INVENTORY_INTERNAL_API_KEY ?? 'change-me';
}
