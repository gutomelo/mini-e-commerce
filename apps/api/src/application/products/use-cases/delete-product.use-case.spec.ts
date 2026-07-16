import { EntityNotFoundError } from '../../../domain/errors';
import { Product } from '../../../domain/catalog/product.entity';
import { CachePort } from '../../ports/cache.port';
import { ProductRepository } from '../ports/product-repository.port';
import { MockedPort } from '../../../test/mocked-port';
import {
  PRODUCTS_LIST_CACHE_PREFIX,
  productIdCacheKey,
  productSlugCacheKey,
} from '../products-cache-keys';
import { DeleteProductUseCase } from './delete-product.use-case';

describe('DeleteProductUseCase', () => {
  const existing: Product = {
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
  let useCase: DeleteProductUseCase;

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
    useCase = new DeleteProductUseCase(productRepository, cache);
  });

  it('soft-deletes the product and invalidates its cache entries plus the list prefix', async () => {
    productRepository.findById.mockResolvedValue(existing);

    await useCase.execute(existing.id);

    expect(productRepository.softDelete).toHaveBeenCalledWith(existing.id);
    expect(cache.delete).toHaveBeenCalledWith(productIdCacheKey(existing.id));
    expect(cache.delete).toHaveBeenCalledWith(productSlugCacheKey(existing.slug));
    expect(cache.deleteByPrefix).toHaveBeenCalledWith(PRODUCTS_LIST_CACHE_PREFIX);
  });

  it('throws EntityNotFoundError when the product does not exist', async () => {
    productRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing-id')).rejects.toBeInstanceOf(EntityNotFoundError);

    expect(productRepository.softDelete).not.toHaveBeenCalled();
    expect(cache.deleteByPrefix).not.toHaveBeenCalled();
  });
});
