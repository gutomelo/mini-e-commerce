import { ConflictError, EntityNotFoundError } from '../../../domain/errors';
import { Category } from '../../../domain/catalog/category.entity';
import { Product } from '../../../domain/catalog/product.entity';
import { CategoryRepository } from '../../categories/ports/category-repository.port';
import { CachePort } from '../../ports/cache.port';
import { ProductRepository } from '../ports/product-repository.port';
import { MockedPort } from '../../../test/mocked-port';
import { PRODUCTS_LIST_CACHE_PREFIX } from '../products-cache-keys';
import { CreateProductUseCase } from './create-product.use-case';

describe('CreateProductUseCase', () => {
  const category: Category = {
    id: 'category-1',
    name: 'Electronics',
    slug: 'electronics',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const input = {
    name: 'Wireless Headphones',
    slug: 'wireless-headphones',
    description: 'Great sound.',
    priceCents: 12999,
    categoryId: category.id,
  };

  const created: Product = {
    id: 'product-1',
    name: input.name,
    slug: input.slug,
    description: input.description,
    priceCents: input.priceCents,
    imageUrl: null,
    categoryId: category.id,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let productRepository: MockedPort<ProductRepository>;
  let categoryRepository: MockedPort<CategoryRepository>;
  let cache: MockedPort<CachePort>;
  let useCase: CreateProductUseCase;

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
    useCase = new CreateProductUseCase(productRepository, categoryRepository, cache);
  });

  it('creates a product and invalidates the product list cache when valid', async () => {
    categoryRepository.findById.mockResolvedValue(category);
    productRepository.existsBySlug.mockResolvedValue(false);
    productRepository.create.mockResolvedValue(created);

    const result = await useCase.execute(input);

    expect(categoryRepository.findById).toHaveBeenCalledWith(category.id);
    expect(productRepository.existsBySlug).toHaveBeenCalledWith(input.slug);
    expect(productRepository.create).toHaveBeenCalledWith(input);
    expect(cache.deleteByPrefix).toHaveBeenCalledWith(PRODUCTS_LIST_CACHE_PREFIX);
    expect(result.id).toBe(created.id);
  });

  it('throws EntityNotFoundError when the category does not exist', async () => {
    categoryRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(EntityNotFoundError);

    expect(productRepository.create).not.toHaveBeenCalled();
    expect(cache.deleteByPrefix).not.toHaveBeenCalled();
  });

  it('throws ConflictError when the slug is already taken', async () => {
    categoryRepository.findById.mockResolvedValue(category);
    productRepository.existsBySlug.mockResolvedValue(true);

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(ConflictError);

    expect(productRepository.create).not.toHaveBeenCalled();
    expect(cache.deleteByPrefix).not.toHaveBeenCalled();
  });
});
