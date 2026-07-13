import { EntityNotFoundError } from '../../../domain/errors';
import { Product } from '../../../domain/catalog/product.entity';
import { CachePort } from '../../ports/cache.port';
import { ProductRepository } from '../ports/product-repository.port';
import { MockedPort } from '../../../test/mocked-port';
import { productIdCacheKey, productSlugCacheKey } from '../products-cache-keys';
import { GetProductUseCase } from './get-product.use-case';

describe('GetProductUseCase', () => {
  const product: Product = {
    id: '11111111-1111-1111-1111-111111111111',
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
  let useCase: GetProductUseCase;

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
    useCase = new GetProductUseCase(productRepository, cache);
  });

  it('looks up by id when given a UUID and caches the result', async () => {
    cache.get.mockResolvedValue(undefined);
    productRepository.findById.mockResolvedValue(product);

    const result = await useCase.execute(product.id);

    expect(productRepository.findById).toHaveBeenCalledWith(product.id);
    expect(productRepository.findBySlug).not.toHaveBeenCalled();
    expect(cache.set).toHaveBeenCalledWith(productIdCacheKey(product.id), result);
  });

  it('looks up by slug when given a non-UUID identifier and caches the result', async () => {
    cache.get.mockResolvedValue(undefined);
    productRepository.findBySlug.mockResolvedValue(product);

    const result = await useCase.execute(product.slug);

    expect(productRepository.findBySlug).toHaveBeenCalledWith(product.slug);
    expect(productRepository.findById).not.toHaveBeenCalled();
    expect(cache.set).toHaveBeenCalledWith(productSlugCacheKey(product.slug), result);
  });

  it('serves the cached result on a hit without querying the repository', async () => {
    cache.get.mockResolvedValue({ id: product.id });

    await useCase.execute(product.slug);

    expect(productRepository.findBySlug).not.toHaveBeenCalled();
    expect(productRepository.findById).not.toHaveBeenCalled();
  });

  it('throws EntityNotFoundError when the product does not exist', async () => {
    cache.get.mockResolvedValue(undefined);
    productRepository.findBySlug.mockResolvedValue(null);

    await expect(useCase.execute('missing-slug')).rejects.toBeInstanceOf(EntityNotFoundError);
  });

  it('treats a soft-deleted (inactive) product as not found', async () => {
    // The repository already filters isActive: true internally, so a
    // deleted product surfaces as a null lookup here.
    cache.get.mockResolvedValue(undefined);
    productRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(product.id)).rejects.toBeInstanceOf(EntityNotFoundError);
  });
});
