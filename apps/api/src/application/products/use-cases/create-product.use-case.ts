import { Injectable } from '@nestjs/common';
import { CategoryRepository } from '../../categories/ports/category-repository.port';
import { ConflictError, EntityNotFoundError } from '../../../domain/errors';
import { CachePort } from '../../ports/cache.port';
import { ProductRepository } from '../ports/product-repository.port';
import { PRODUCTS_LIST_CACHE_PREFIX } from '../products-cache-keys';
import { ProductOutput, toProductOutput } from './product-output';

export interface CreateProductInput {
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  imageUrl?: string;
  categoryId: string;
}

/**
 * Creates a product. Validates that `categoryId` refers to an existing
 * category (`EntityNotFoundError`, 404) and that `slug` is not already
 * taken (`ConflictError`, 409) before persisting. Invalidates every cached
 * product list variant on success (a new product can appear in any of
 * them).
 */
@Injectable()
export class CreateProductUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly cache: CachePort,
  ) {}

  async execute(input: CreateProductInput): Promise<ProductOutput> {
    const category = await this.categoryRepository.findById(input.categoryId);
    if (!category) {
      throw new EntityNotFoundError('Category', input.categoryId);
    }

    const slugTaken = await this.productRepository.existsBySlug(input.slug);
    if (slugTaken) {
      throw new ConflictError(`Product with slug "${input.slug}" already exists`);
    }

    const product = await this.productRepository.create(input);
    await this.cache.deleteByPrefix(PRODUCTS_LIST_CACHE_PREFIX);
    return toProductOutput(product);
  }
}
