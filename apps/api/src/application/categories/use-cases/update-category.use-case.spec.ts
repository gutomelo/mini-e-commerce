import { ConflictError, EntityNotFoundError } from '../../../domain/errors';
import { Category } from '../../../domain/catalog/category.entity';
import { CachePort } from '../../ports/cache.port';
import { CategoryRepository } from '../ports/category-repository.port';
import { MockedPort } from '../../../test/mocked-port';
import { CATEGORIES_LIST_CACHE_KEY } from '../categories-cache-keys';
import { UpdateCategoryUseCase } from './update-category.use-case';

describe('UpdateCategoryUseCase', () => {
  const existingCategory: Category = {
    id: 'category-1',
    name: 'Electronics',
    slug: 'electronics',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const otherCategory: Category = {
    id: 'category-2',
    name: 'Apparel',
    slug: 'apparel',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let categoryRepository: MockedPort<CategoryRepository>;
  let cache: MockedPort<CachePort>;
  let useCase: UpdateCategoryUseCase;

  beforeEach(() => {
    categoryRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByNameOrSlug: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countProductsByCategory: jest.fn(),
    };
    cache = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      deleteByPrefix: jest.fn(),
    };
    useCase = new UpdateCategoryUseCase(categoryRepository, cache);
  });

  it('updates the category and invalidates the cached list', async () => {
    categoryRepository.findById.mockResolvedValue(existingCategory);
    categoryRepository.findByNameOrSlug.mockResolvedValue(null);
    const updated: Category = { ...existingCategory, name: 'Consumer Electronics' };
    categoryRepository.update.mockResolvedValue(updated);

    const result = await useCase.execute(existingCategory.id, { name: 'Consumer Electronics' });

    expect(categoryRepository.update).toHaveBeenCalledWith(existingCategory.id, {
      name: 'Consumer Electronics',
    });
    expect(cache.delete).toHaveBeenCalledWith(CATEGORIES_LIST_CACHE_KEY);
    expect(result).toEqual(updated);
  });

  it('throws EntityNotFoundError when the category does not exist', async () => {
    categoryRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing-id', { name: 'New Name' })).rejects.toBeInstanceOf(
      EntityNotFoundError,
    );

    expect(categoryRepository.update).not.toHaveBeenCalled();
    expect(cache.delete).not.toHaveBeenCalled();
  });

  it('throws ConflictError when renaming to a name/slug used by a different category', async () => {
    categoryRepository.findById.mockResolvedValue(existingCategory);
    categoryRepository.findByNameOrSlug.mockResolvedValue(otherCategory);

    await expect(
      useCase.execute(existingCategory.id, { name: otherCategory.name, slug: otherCategory.slug }),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(categoryRepository.update).not.toHaveBeenCalled();
    expect(cache.delete).not.toHaveBeenCalled();
  });

  it('allows updating a category to its own current name/slug', async () => {
    categoryRepository.findById.mockResolvedValue(existingCategory);
    categoryRepository.findByNameOrSlug.mockResolvedValue(existingCategory);
    categoryRepository.update.mockResolvedValue(existingCategory);

    const result = await useCase.execute(existingCategory.id, {
      name: existingCategory.name,
      slug: existingCategory.slug,
    });

    expect(result).toEqual(existingCategory);
    expect(cache.delete).toHaveBeenCalledWith(CATEGORIES_LIST_CACHE_KEY);
  });
});
