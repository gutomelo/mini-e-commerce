import { ProductListFilter } from '../../domain/catalog/product.entity';

/**
 * Cache key prefix for product list queries (see
 * `docs/specs/2026-07-12-api-core.md`). Every distinct normalized filter is
 * cached under its own key (`products:list:<query-hash>`); write use cases
 * invalidate the whole prefix via `CachePort.deleteByPrefix` rather than
 * tracking every generated variant.
 */
export const PRODUCTS_LIST_CACHE_PREFIX = 'products:list:';

/** Cache key for a single product looked up by id. */
export function productIdCacheKey(id: string): string {
  return `products:id:${id}`;
}

/** Cache key for a single product looked up by slug. */
export function productSlugCacheKey(slug: string): string {
  return `products:slug:${slug}`;
}

/**
 * Builds a stable cache key for a normalized product list filter. Object
 * key order is fixed explicitly (rather than relying on insertion order)
 * so the same logical filter always serializes to the same key.
 */
export function productListCacheKey(filter: ProductListFilter): string {
  const stable = {
    page: filter.page,
    limit: filter.limit,
    search: filter.search ?? null,
    categorySlug: filter.categorySlug ?? null,
    minPriceCents: filter.minPriceCents ?? null,
    maxPriceCents: filter.maxPriceCents ?? null,
    sortField: filter.sortField,
    sortDirection: filter.sortDirection,
  };
  return `${PRODUCTS_LIST_CACHE_PREFIX}${JSON.stringify(stable)}`;
}
