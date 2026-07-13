import { Injectable } from '@nestjs/common';
import { ConflictError, EntityNotFoundError } from '../../../domain/errors';
import { CachePort } from '../../ports/cache.port';
import { CategoryRepository } from '../ports/category-repository.port';
import { CATEGORIES_LIST_CACHE_KEY } from '../categories-cache-keys';
import { CategoryOutput } from './list-categories.use-case';

export interface UpdateCategoryInput {
  name?: string;
  slug?: string;
}

/**
 * Partially updates a category (`name` and/or `slug`). Throws
 * `EntityNotFoundError` (404) when the id does not exist, and `ConflictError`
 * (409) when renaming would collide with a different category's unique
 * name/slug. Invalidates the cached category list on success.
 */
@Injectable()
export class UpdateCategoryUseCase {
  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly cache: CachePort,
  ) {}

  async execute(id: string, input: UpdateCategoryInput): Promise<CategoryOutput> {
    const existing = await this.categoryRepository.findById(id);
    if (!existing) {
      throw new EntityNotFoundError('Category', id);
    }

    if (input.name !== undefined || input.slug !== undefined) {
      const candidateName = input.name ?? existing.name;
      const candidateSlug = input.slug ?? existing.slug;
      const conflict = await this.categoryRepository.findByNameOrSlug(candidateName, candidateSlug);
      if (conflict && conflict.id !== id) {
        throw new ConflictError(
          `Category with name "${candidateName}" or slug "${candidateSlug}" already exists`,
        );
      }
    }

    const updated = await this.categoryRepository.update(id, input);
    await this.cache.delete(CATEGORIES_LIST_CACHE_KEY);
    return updated;
  }
}
