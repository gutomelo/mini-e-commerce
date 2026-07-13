import { Injectable } from '@nestjs/common';
import { CachePort } from '../../ports/cache.port';
import { CategoryRepository } from '../ports/category-repository.port';
import { CATEGORIES_LIST_CACHE_KEY } from '../categories-cache-keys';

export interface CategoryOutput {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Lists every category. Cache-aside: serves the full list from Redis when
 * present, otherwise queries Prisma and populates the cache (default TTL,
 * 5 minutes). Write use cases (`Create`/`Update`/`Delete`) invalidate
 * `categories:list` so this never serves stale data after a mutation.
 */
@Injectable()
export class ListCategoriesUseCase {
  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly cache: CachePort,
  ) {}

  async execute(): Promise<CategoryOutput[]> {
    const cached = await this.cache.get<CategoryOutput[]>(CATEGORIES_LIST_CACHE_KEY);
    if (cached) {
      return cached;
    }

    const categories = await this.categoryRepository.findAll();
    const output = categories.map(toOutput);
    await this.cache.set(CATEGORIES_LIST_CACHE_KEY, output);
    return output;
  }
}

function toOutput(category: {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}): CategoryOutput {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}
