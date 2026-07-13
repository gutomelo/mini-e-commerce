import { ConflictError, EntityNotFoundError } from '../../../domain/errors';
import { Category } from '../../../domain/catalog/category.entity';
import { Product } from '../../../domain/catalog/product.entity';
import { CategoryRepository } from '../../categories/ports/category-repository.port';
import { CachePort } from '../../ports/cache.port';
import { ProductRepository } from '../ports/product-repository.port';
import { MockedPort } from '../../../test/mocked-port';
import {
  PRODUCTS_LIST_CACHE_PREFIX,
  productIdCacheKey,
  productSlugCacheKey,
} from '../products-cache-keys';
import { UpdateProductUseCase } from './update-product.use-case';

describe('UpdateProductUseCase', () => {
  const category: Category = {
    id: 'category-1',
    name: 'Electronics',
    slug: 'electronics',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const existing: Product = {
    id: 'product-1',
    name: 'Wireless Headphones',
    slug: 'wireless-headphones',
    description: 'Great sound.',
    priceCents: 12999,
    imageUrl: null,
    categoryId: category.id,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let productRepository: MockedPort<ProductRepository>;
  let categoryRepository: MockedPort<CategoryRepository>;
  let cache: MockedPort<CachePort>;
  let useCase: UpdateProductUseCase;

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
    useCase = new UpdateProductUseCase(productRepository, categoryRepository, cache);
  });

  it('updates the product and invalidates old id/slug keys plus the list prefix', async () => {
    productRepository.findById.mockResolvedValue(existing);
    const updated = { ...existing, name: 'New Name' };
    productRepository.update.mockResolvedValue(updated);

    const result = await useCase.execute(existing.id, { name: 'New Name' });

    expect(productRepository.update).toHaveBeenCalledWith(existing.id, { name: 'New Name' });
    expect(cache.delete).toHaveBeenCalledWith(productIdCacheKey(existing.id));
    expect(cache.delete).toHaveBeenCalledWith(productSlugCacheKey(existing.slug));
    expect(cache.deleteByPrefix).toHaveBeenCalledWith(PRODUCTS_LIST_CACHE_PREFIX);
    expect(result.name).toBe('New Name');
  });

  it('also invalidates the new slug key when the slug changes', async () => {
    productRepository.findById.mockResolvedValue(existing);
    productRepository.existsBySlug.mockResolvedValue(false);
    productRepository.update.mockResolvedValue({ ...existing, slug: 'new-slug' });

    await useCase.execute(existing.id, { slug: 'new-slug' });

    expect(cache.delete).toHaveBeenCalledWith(productSlugCacheKey('new-slug'));
    expect(cache.delete).toHaveBeenCalledWith(productSlugCacheKey(existing.slug));
  });

  it('revalidates categoryId when changed and throws EntityNotFoundError if missing', async () => {
    productRepository.findById.mockResolvedValue(existing);
    categoryRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(existing.id, { categoryId: 'other-category' }),
    ).rejects.toBeInstanceOf(EntityNotFoundError);

    expect(productRepository.update).not.toHaveBeenCalled();
  });

  it('throws EntityNotFoundError when the product does not exist', async () => {
    productRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing-id', { name: 'X' })).rejects.toBeInstanceOf(
      EntityNotFoundError,
    );

    expect(productRepository.update).not.toHaveBeenCalled();
    expect(cache.deleteByPrefix).not.toHaveBeenCalled();
  });

  it('throws ConflictError when renaming to a slug already taken by another product', async () => {
    productRepository.findById.mockResolvedValue(existing);
    productRepository.existsBySlug.mockResolvedValue(true);

    await expect(useCase.execute(existing.id, { slug: 'taken-slug' })).rejects.toBeInstanceOf(
      ConflictError,
    );

    expect(productRepository.update).not.toHaveBeenCalled();
    expect(cache.deleteByPrefix).not.toHaveBeenCalled();
  });
});
