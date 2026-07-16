import { Injectable } from '@nestjs/common';
import { EntityNotFoundError } from '../../../domain/errors';
import { CachePort } from '../../ports/cache.port';
import { ProductRepository } from '../ports/product-repository.port';
import {
  PRODUCTS_LIST_CACHE_PREFIX,
  productIdCacheKey,
  productSlugCacheKey,
} from '../products-cache-keys';

/**
 * Soft-deletes a product (`isActive = false`). Throws `EntityNotFoundError`
 * (404) when the id does not exist (or is already inactive, since reads
 * treat inactive products as nonexistent). Invalidates the product's id/slug
 * cache entries plus every cached list variant on success.
 */
@Injectable()
export class DeleteProductUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly cache: CachePort,
  ) {}

  async execute(id: string): Promise<void> {
    const existing = await this.productRepository.findById(id);
    if (!existing) {
      throw new EntityNotFoundError('Product', id);
    }

    await this.productRepository.softDelete(id);

    await this.cache.delete(productIdCacheKey(id));
    await this.cache.delete(productSlugCacheKey(existing.slug));
    await this.cache.deleteByPrefix(PRODUCTS_LIST_CACHE_PREFIX);
  }
}
