import { Product } from '../../../domain/catalog/product.entity';
import { CachePort } from '../../ports/cache.port';
import { ProductRepository } from '../ports/product-repository.port';
import { MockedPort } from '../../../test/mocked-port';
import { productListCacheKey } from '../products-cache-keys';
import { ListProductsUseCase } from './list-products.use-case';

describe('ListProductsUseCase', () => {
  const product: Product = {
    id: 'product-1',
    name: 'Wireless Headphones',
    slug: 'wireless-headphones',
    description: 'Great sound.',
    priceCents: 12999,
    imageUrl: null,
    categoryId: 'category-1',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let productRepository: MockedPort<ProductRepository>;
  let cache: MockedPort<CachePort>;
  let useCase: ListProductsUseCase;

  beforeEach(() => {
    productRepository = {
      list: jest.fn(),
      findById: jest.fn(),
      findBySlug: jest.fn(),
      existsBySlug: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };
    cache = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      deleteByPrefix: jest.fn(),
    };
    useCase = new ListProductsUseCase(productRepository, cache);
  });

  it('serves the cached result on a hit without querying the repository', async () => {
    const cached = { items: [], total: 0, page: 1, limit: 20 };
    cache.get.mockResolvedValue(cached);

    const result = await useCase.execute({});

    expect(result).toEqual(cached);
    expect(productRepository.list).not.toHaveBeenCalled();
  });

  it('normalizes the filter, queries the repository, and populates the cache on a miss', async () => {
    cache.get.mockResolvedValue(undefined);
    productRepository.list.mockResolvedValue({ items: [product], total: 1 });

    const result = await useCase.execute({ page: 1, limit: 20 });

    expect(productRepository.list).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      sortField: 'createdAt',
      sortDirection: 'desc',
    });
    expect(result.items).toEqual([
      {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        priceCents: product.priceCents,
        imageUrl: product.imageUrl,
        categoryId: product.categoryId,
        isActive: product.isActive,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      },
    ]);
    expect(result.total).toBe(1);
    expect(cache.set).toHaveBeenCalledWith(
      productListCacheKey({ page: 1, limit: 20, sortField: 'createdAt', sortDirection: 'desc' }),
      result,
    );
  });

  it('clamps page < 1 to 1 and limit above 100 to 100', async () => {
    cache.get.mockResolvedValue(undefined);
    productRepository.list.mockResolvedValue({ items: [], total: 0 });

    await useCase.execute({ page: -5, limit: 500 });

    expect(productRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 100 }),
    );
  });

  it('parses a valid sort query and falls back to createdAt:desc for an invalid one', async () => {
    cache.get.mockResolvedValue(undefined);
    productRepository.list.mockResolvedValue({ items: [], total: 0 });

    await useCase.execute({ sort: 'price:asc' });
    expect(productRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({ sortField: 'price', sortDirection: 'asc' }),
    );

    await useCase.execute({ sort: 'bogus:xyz' });
    expect(productRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({ sortField: 'createdAt', sortDirection: 'desc' }),
    );
  });

  it('passes through search, category, and price filters when provided', async () => {
    cache.get.mockResolvedValue(undefined);
    productRepository.list.mockResolvedValue({ items: [], total: 0 });

    await useCase.execute({
      search: '  headphones  ',
      category: 'electronics',
      minPrice: 1000,
      maxPrice: 20000,
    });

    expect(productRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'headphones',
        categorySlug: 'electronics',
        minPriceCents: 1000,
        maxPriceCents: 20000,
      }),
    );
  });
});
