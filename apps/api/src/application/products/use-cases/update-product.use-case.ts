import { Injectable } from '@nestjs/common';
import { CategoryRepository } from '../../categories/ports/category-repository.port';
import { ConflictError, EntityNotFoundError } from '../../../domain/errors';
import { CachePort } from '../../ports/cache.port';
import { ProductRepository } from '../ports/product-repository.port';
import {
  PRODUCTS_LIST_CACHE_PREFIX,
  productIdCacheKey,
  productSlugCacheKey,
} from '../products-cache-keys';
import { ProductOutput, toProductOutput } from './product-output';

export interface UpdateProductInput {
  name?: string;
  slug?: string;
  description?: string;
  priceCents?: number;
  imageUrl?: string;
  categoryId?: string;
}

/**
 * Partially updates a product. Throws `EntityNotFoundError` (404) when the
 * id does not exist, revalidates `categoryId` when changed (404 if the new
 * category does not exist), and checks slug uniqueness when renaming
 * (`ConflictError`, 409). Invalidates the old and new id/slug cache
 * entries plus every cached list variant on success.
 */
@Injectable()
export class UpdateProductUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly cache: CachePort,
  ) {}

  async execute(id: string, input: UpdateProductInput): Promise<ProductOutput> {
    const existing = await this.productRepository.findById(id);
    if (!existing) {
      throw new EntityNotFoundError('Product', id);
    }

    if (input.categoryId && input.categoryId !== existing.categoryId) {
      const category = await this.categoryRepository.findById(input.categoryId);
      if (!category) {
        throw new EntityNotFoundError('Category', input.categoryId);
      }
    }

    if (input.slug && input.slug !== existing.slug) {
      const slugTaken = await this.productRepository.existsBySlug(input.slug);
      if (slugTaken) {
        throw new ConflictError(`Product with slug "${input.slug}" already exists`);
      }
    }

    const updated = await this.productRepository.update(id, input);

    await this.cache.delete(productIdCacheKey(id));
    await this.cache.delete(productSlugCacheKey(existing.slug));
    if (input.slug && input.slug !== existing.slug) {
      await this.cache.delete(productSlugCacheKey(input.slug));
    }
    await this.cache.deleteByPrefix(PRODUCTS_LIST_CACHE_PREFIX);

    return toProductOutput(updated);
  }
}
