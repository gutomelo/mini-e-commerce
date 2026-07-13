import { ConflictError, EntityNotFoundError } from '../../../domain/errors';
import { Category } from '../../../domain/catalog/category.entity';
import { CachePort } from '../../ports/cache.port';
import { CategoryRepository } from '../ports/category-repository.port';
import { MockedPort } from '../../../test/mocked-port';
import { CATEGORIES_LIST_CACHE_KEY } from '../categories-cache-keys';
import { DeleteCategoryUseCase } from './delete-category.use-case';

describe('DeleteCategoryUseCase', () => {
  const existingCategory: Category = {
    id: 'category-1',
    name: 'Electronics',
    slug: 'electronics',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let categoryRepository: MockedPort<CategoryRepository>;
  let cache: MockedPort<CachePort>;
  let useCase: DeleteCategoryUseCase;

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
    useCase = new DeleteCategoryUseCase(categoryRepository, cache);
  });

  it('deletes the category and invalidates the cached list when it has no products', async () => {
    categoryRepository.findById.mockResolvedValue(existingCategory);
    categoryRepository.countProductsByCategory.mockResolvedValue(0);

    await useCase.execute(existingCategory.id);

    expect(categoryRepository.delete).toHaveBeenCalledWith(existingCategory.id);
    expect(cache.delete).toHaveBeenCalledWith(CATEGORIES_LIST_CACHE_KEY);
  });

  it('throws EntityNotFoundError when the category does not exist', async () => {
    categoryRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing-id')).rejects.toBeInstanceOf(EntityNotFoundError);

    expect(categoryRepository.delete).not.toHaveBeenCalled();
    expect(cache.delete).not.toHaveBeenCalled();
  });

  it('throws ConflictError when the category still has products', async () => {
    categoryRepository.findById.mockResolvedValue(existingCategory);
    categoryRepository.countProductsByCategory.mockResolvedValue(3);

    await expect(useCase.execute(existingCategory.id)).rejects.toBeInstanceOf(ConflictError);

    expect(categoryRepository.delete).not.toHaveBeenCalled();
    expect(cache.delete).not.toHaveBeenCalled();
  });
});
