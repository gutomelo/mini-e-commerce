import { Injectable } from '@nestjs/common';
import { EntityNotFoundError } from '../../../domain/errors';
import { CachePort } from '../../ports/cache.port';
import { ProductRepository } from '../ports/product-repository.port';
import { productIdCacheKey, productSlugCacheKey } from '../products-cache-keys';
import { ProductOutput, toProductOutput } from './product-output';

/** Heuristic used to decide whether `:idOrSlug` should be looked up by id or by slug. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Looks up a single product by id or slug (`GET /products/:idOrSlug`).
 * Cache-aside per lookup kind (`products:id:<id>` / `products:slug:<slug>`).
 * Soft-deleted products (`isActive: false`) are invisible here — the
 * repository's `findById`/`findBySlug` already filter them out — so a
 * lookup against a deleted product raises `EntityNotFoundError` (404) just
 * like an unknown identifier.
 */
@Injectable()
export class GetProductUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly cache: CachePort,
  ) {}

  async execute(idOrSlug: string): Promise<ProductOutput> {
    const isId = UUID_PATTERN.test(idOrSlug);
    const cacheKey = isId ? productIdCacheKey(idOrSlug) : productSlugCacheKey(idOrSlug);

    const cached = await this.cache.get<ProductOutput>(cacheKey);
    if (cached) {
      return cached;
    }

    const product = isId
      ? await this.productRepository.findById(idOrSlug)
      : await this.productRepository.findBySlug(idOrSlug);

    if (!product) {
      throw new EntityNotFoundError('Product', idOrSlug);
    }

    const output = toProductOutput(product);
    await this.cache.set(cacheKey, output);
    return output;
  }
}
