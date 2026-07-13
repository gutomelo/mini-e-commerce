import { ConflictError } from '../../../domain/errors';
import { Category } from '../../../domain/catalog/category.entity';
import { CachePort } from '../../ports/cache.port';
import { CategoryRepository } from '../ports/category-repository.port';
import { MockedPort } from '../../../test/mocked-port';
import { CATEGORIES_LIST_CACHE_KEY } from '../categories-cache-keys';
import { CreateCategoryUseCase } from './create-category.use-case';

describe('CreateCategoryUseCase', () => {
  const existingCategory: Category = {
    id: 'category-1',
    name: 'Electronics',
    slug: 'electronics',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let categoryRepository: MockedPort<CategoryRepository>;
  let cache: MockedPort<CachePort>;
  let useCase: CreateCategoryUseCase;

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
    useCase = new CreateCategoryUseCase(categoryRepository, cache);
  });

  it('creates a category and invalidates the cached list when name/slug are free', async () => {
    categoryRepository.findByNameOrSlug.mockResolvedValue(null);
    const created: Category = {
      id: 'category-2',
      name: 'Apparel',
      slug: 'apparel',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    categoryRepository.create.mockResolvedValue(created);

    const result = await useCase.execute({ name: 'Apparel', slug: 'apparel' });

    expect(categoryRepository.findByNameOrSlug).toHaveBeenCalledWith('Apparel', 'apparel');
    expect(categoryRepository.create).toHaveBeenCalledWith({ name: 'Apparel', slug: 'apparel' });
    expect(cache.delete).toHaveBeenCalledWith(CATEGORIES_LIST_CACHE_KEY);
    expect(result).toEqual(created);
  });

  it('throws ConflictError when the name or slug is already taken', async () => {
    categoryRepository.findByNameOrSlug.mockResolvedValue(existingCategory);

    await expect(
      useCase.execute({ name: existingCategory.name, slug: existingCategory.slug }),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(categoryRepository.create).not.toHaveBeenCalled();
    expect(cache.delete).not.toHaveBeenCalled();
  });
});
