import { Injectable } from '@nestjs/common';
import { ConflictError, EntityNotFoundError } from '../../../domain/errors';
import { CachePort } from '../../ports/cache.port';
import { CategoryRepository } from '../ports/category-repository.port';
import { CATEGORIES_LIST_CACHE_KEY } from '../categories-cache-keys';

/**
 * Deletes a category (hard delete — the schema has no soft-delete flag on
 * `Category`, unlike `Product.isActive`). Throws `EntityNotFoundError` (404)
 * when the id does not exist.
 *
 * `Product.categoryId` is a required FK with no `onDelete` cascade, so
 * deleting a category that still has products would violate the DB
 * constraint. Rather than let that raw Postgres/Prisma error surface, this
 * use case pre-checks the product count via the repository and reports it
 * as a domain `ConflictError` (409) with a clear message — keeping the
 * domain layer free of Prisma-specific error codes.
 */
@Injectable()
export class DeleteCategoryUseCase {
  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly cache: CachePort,
  ) {}

  async execute(id: string): Promise<void> {
    const existing = await this.categoryRepository.findById(id);
    if (!existing) {
      throw new EntityNotFoundError('Category', id);
    }

    const productCount = await this.categoryRepository.countProductsByCategory(id);
    if (productCount > 0) {
      throw new ConflictError(
        `Category "${existing.name}" has ${productCount} associated product(s) and cannot be deleted`,
      );
    }

    await this.categoryRepository.delete(id);
    await this.cache.delete(CATEGORIES_LIST_CACHE_KEY);
  }
}
