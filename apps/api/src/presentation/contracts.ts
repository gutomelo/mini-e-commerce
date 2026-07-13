/**
 * Re-exports the shared REST API envelope contracts so presentation-layer
 * code (controllers, filters, interceptors) can import them from a local,
 * stable path. The actual shapes live in `@mini-e-commerce/types` and are
 * shared with the storefront and admin frontends.
 */
export type {
  PaginationMeta,
  ListResponse,
  SingleResponse,
  ErrorResponse,
} from '@mini-e-commerce/types';
