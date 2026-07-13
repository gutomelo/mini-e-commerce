import { Injectable } from '@nestjs/common';
import { ConflictError } from '../../../domain/errors';
import { CachePort } from '../../ports/cache.port';
import { CategoryRepository } from '../ports/category-repository.port';
import { CATEGORIES_LIST_CACHE_KEY } from '../categories-cache-keys';
import { CategoryOutput } from './list-categories.use-case';

export interface CreateCategoryInput {
  name: string;
  slug: string;
}

/**
 * Creates a category. `name` and `slug` are both unique per the Prisma
 * schema, so uniqueness is checked up front and reported as a domain
 * `ConflictError` (409) rather than surfacing a raw DB constraint error.
 * Invalidates the cached category list on success.
 */
@Injectable()
export class CreateCategoryUseCase {
  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly cache: CachePort,
  ) {}

  async execute(input: CreateCategoryInput): Promise<CategoryOutput> {
    const existing = await this.categoryRepository.findByNameOrSlug(input.name, input.slug);
    if (existing) {
      throw new ConflictError(
        `Category with name "${input.name}" or slug "${input.slug}" already exists`,
      );
    }

    const category = await this.categoryRepository.create(input);
    await this.cache.delete(CATEGORIES_LIST_CACHE_KEY);
    return category;
  }
}
