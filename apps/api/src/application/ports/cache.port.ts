/**
 * Default TTL (seconds) applied to cache entries when no explicit TTL is
 * provided. Matches the 5-minute policy from the API core spec for
 * read-only catalog data (product list/detail, categories).
 */
export const DEFAULT_CACHE_TTL_SECONDS = 300;

/**
 * Application-layer cache port (cache-aside pattern). Infrastructure
 * provides the concrete adapter (Redis today); use cases depend only on
 * this interface so business logic stays framework-agnostic.
 *
 * Implementations must degrade gracefully: if the underlying cache store
 * is unreachable or errors, `get` resolves to `undefined` (a cache miss)
 * and `set`/`delete`/`deleteByPrefix` resolve without throwing. Callers
 * can always fall back to the repository without special-casing cache
 * failures.
 */
export abstract class CachePort {
  /** Returns the cached value for `key`, or `undefined` on a miss or cache failure. */
  abstract get<T>(key: string): Promise<T | undefined>;

  /** Stores `value` under `key` with an optional TTL override (seconds). */
  abstract set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  /** Removes a single key. */
  abstract delete(key: string): Promise<void>;

  /**
   * Removes every key matching `prefix*` (e.g. `products:list:` to
   * invalidate every cached product list variant). Used by write use
   * cases to bust cached collections without tracking every query hash.
   */
  abstract deleteByPrefix(prefix: string): Promise<void>;
}
