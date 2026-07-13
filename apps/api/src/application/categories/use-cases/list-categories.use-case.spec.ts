import { Category } from '../../../domain/catalog/category.entity';
import { CachePort } from '../../ports/cache.port';
import { CategoryRepository } from '../ports/category-repository.port';
import { MockedPort } from '../../../test/mocked-port';
import { CATEGORIES_LIST_CACHE_KEY } from '../categories-cache-keys';
import { ListCategoriesUseCase } from './list-categories.use-case';

describe('ListCategoriesUseCase', () => {
  const category: Category = {
    id: 'category-1',
    name: 'Electronics',
    slug: 'electronics',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let categoryRepository: MockedPort<CategoryRepository>;
  let cache: MockedPort<CachePort>;
  let useCase: ListCategoriesUseCase;

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
    useCase = new ListCategoriesUseCase(categoryRepository, cache);
  });

  it('returns the cached list without querying the repository on a cache hit', async () => {
    const cached = [category];
    cache.get.mockResolvedValue(cached);

    const result = await useCase.execute();

    expect(result).toBe(cached);
    expect(cache.get).toHaveBeenCalledWith(CATEGORIES_LIST_CACHE_KEY);
    expect(categoryRepository.findAll).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('queries the repository and populates the cache on a cache miss', async () => {
    cache.get.mockResolvedValue(undefined);
    categoryRepository.findAll.mockResolvedValue([category]);

    const result = await useCase.execute();

    expect(categoryRepository.findAll).toHaveBeenCalled();
    expect(cache.set).toHaveBeenCalledWith(CATEGORIES_LIST_CACHE_KEY, result);
    expect(result).toEqual([
      {
        id: category.id,
        name: category.name,
        slug: category.slug,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      },
    ]);
  });
});
