import { Injectable } from '@nestjs/common';
import {
  ProductListFilter,
  ProductSortDirection,
  ProductSortField,
} from '../../../domain/catalog/product.entity';
import { CachePort } from '../../ports/cache.port';
import { ProductRepository } from '../ports/product-repository.port';
import { productListCacheKey } from '../products-cache-keys';
import { ProductOutput, toProductOutput } from './product-output';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;

/** Raw query input as received from the controller (unvalidated ranges, optional filters). */
export interface ListProductsInput {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
}

export interface ListProductsOutput {
  items: ProductOutput[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Lists products with pagination, filtering and sorting. Normalizes the raw
 * query input (clamps `page`/`limit`, parses `sort=<field>:<direction>`)
 * before building the cache key, so equivalent requests (e.g. `limit=0` and
 * omitted `limit`) share the same cached entry. Cache-aside: serves the
 * `{ items, total }` result from Redis when present, otherwise queries
 * Prisma and populates the cache (default TTL, 5 minutes). Write use cases
 * invalidate the whole `products:list:` prefix so this never serves stale
 * data after a mutation.
 */
@Injectable()
export class ListProductsUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly cache: CachePort,
  ) {}

  async execute(input: ListProductsInput): Promise<ListProductsOutput> {
    const filter = normalizeFilter(input);
    const cacheKey = productListCacheKey(filter);

    const cached = await this.cache.get<ListProductsOutput>(cacheKey);
    if (cached) {
      return cached;
    }

    const { items, total } = await this.productRepository.list(filter);
    const output: ListProductsOutput = {
      items: items.map(toProductOutput),
      total,
      page: filter.page,
      limit: filter.limit,
    };
    await this.cache.set(cacheKey, output);
    return output;
  }
}

/**
 * Clamps `page` to >= 1 and `limit` to the [1, 100] range (default 20).
 * Parses `sort` as `<field>:<direction>` (e.g. `price:asc`,
 * `createdAt:desc`); falls back to `createdAt:desc` for anything
 * unrecognized rather than rejecting the request.
 */
function normalizeFilter(input: ListProductsInput): ProductListFilter {
  const page =
    Number.isFinite(input.page) && (input.page as number) > 0
      ? Math.floor(input.page as number)
      : DEFAULT_PAGE;
  const rawLimit = Number.isFinite(input.limit) ? Math.floor(input.limit as number) : DEFAULT_LIMIT;
  const limit = Math.min(Math.max(rawLimit, MIN_LIMIT), MAX_LIMIT);

  const { sortField, sortDirection } = parseSort(input.sort);

  const filter: ProductListFilter = {
    page,
    limit,
    sortField,
    sortDirection,
  };

  if (input.search?.trim()) {
    filter.search = input.search.trim();
  }
  if (input.category?.trim()) {
    filter.categorySlug = input.category.trim();
  }
  if (isFiniteNumber(input.minPrice)) {
    filter.minPriceCents = input.minPrice;
  }
  if (isFiniteNumber(input.maxPrice)) {
    filter.maxPriceCents = input.maxPrice;
  }

  return filter;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

const SORT_FIELDS: ProductSortField[] = ['createdAt', 'price'];
const SORT_DIRECTIONS: ProductSortDirection[] = ['asc', 'desc'];

function parseSort(sort?: string): {
  sortField: ProductSortField;
  sortDirection: ProductSortDirection;
} {
  const fallback = {
    sortField: 'createdAt' as ProductSortField,
    sortDirection: 'desc' as ProductSortDirection,
  };
  if (!sort) {
    return fallback;
  }

  const [field, direction] = sort.split(':');
  if (
    !SORT_FIELDS.includes(field as ProductSortField) ||
    !SORT_DIRECTIONS.includes(direction as ProductSortDirection)
  ) {
    return fallback;
  }

  return { sortField: field as ProductSortField, sortDirection: direction as ProductSortDirection };
}
