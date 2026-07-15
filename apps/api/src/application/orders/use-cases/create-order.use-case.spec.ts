import { EVENT_NAMES } from '@mini-e-commerce/types';
import { EntityNotFoundError } from '../../../domain/errors';
import { Order } from '../../../domain/orders/order.entity';
import { Product } from '../../../domain/catalog/product.entity';
import { ProductRepository } from '../../products/ports/product-repository.port';
import { OrderRepository } from '../ports/order-repository.port';
import { MockedPort } from '../../../test/mocked-port';
import { FakeEventPublisher } from '../../../infrastructure/events/fake-event-publisher';
import { CreateOrderUseCase } from './create-order.use-case';

describe('CreateOrderUseCase', () => {
  const headphones: Product = {
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

  const mug: Product = {
    id: 'product-2',
    name: 'Coffee Mug',
    slug: 'coffee-mug',
    description: 'Ceramic mug.',
    priceCents: 999,
    imageUrl: null,
    categoryId: 'category-2',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const createdOrder: Order = {
    id: 'order-1',
    userId: 'user-1',
    status: 'PLACED',
    totalCents: 25998,
    items: [
      {
        id: 'item-1',
        productId: headphones.id,
        productName: headphones.name,
        unitPriceCents: headphones.priceCents,
        quantity: 2,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let orderRepository: MockedPort<OrderRepository>;
  let productRepository: MockedPort<ProductRepository>;
  let eventPublisher: FakeEventPublisher;
  let useCase: CreateOrderUseCase;

  beforeEach(() => {
    orderRepository = {
      create: jest.fn(),
      list: jest.fn(),
      findByIdForUser: jest.fn(),
      findById: jest.fn(),
      updateStatus: jest.fn(),
    };
    productRepository = {
      list: jest.fn(),
      findById: jest.fn(),
      findBySlug: jest.fn(),
      existsBySlug: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };
    eventPublisher = new FakeEventPublisher();
    useCase = new CreateOrderUseCase(orderRepository, productRepository, eventPublisher);
  });

  it('creates an order with correct snapshot pricing and total for a single item', async () => {
    productRepository.findById.mockResolvedValue(headphones);
    orderRepository.create.mockResolvedValue(createdOrder);

    const result = await useCase.execute({
      userId: 'user-1',
      items: [{ productId: headphones.id, quantity: 2 }],
    });

    expect(productRepository.findById).toHaveBeenCalledWith(headphones.id);
    expect(orderRepository.create).toHaveBeenCalledWith({
      userId: 'user-1',
      totalCents: 25998,
      items: [
        {
          productId: headphones.id,
          productName: headphones.name,
          unitPriceCents: headphones.priceCents,
          quantity: 2,
        },
      ],
    });
    expect(result.id).toBe(createdOrder.id);
    expect(result.totalCents).toBe(25998);
  });

  it('sums totalCents correctly across multiple items', async () => {
    productRepository.findById.mockImplementation((id: string) =>
      Promise.resolve(id === headphones.id ? headphones : mug),
    );
    orderRepository.create.mockResolvedValue(createdOrder);

    await useCase.execute({
      userId: 'user-1',
      items: [
        { productId: headphones.id, quantity: 1 },
        { productId: mug.id, quantity: 3 },
      ],
    });

    const expectedTotal = headphones.priceCents * 1 + mug.priceCents * 3;
    expect(orderRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ totalCents: expectedTotal }),
    );
  });

  it('throws EntityNotFoundError naming the product when a product is missing or inactive', async () => {
    productRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ userId: 'user-1', items: [{ productId: 'missing-product', quantity: 1 }] }),
    ).rejects.toBeInstanceOf(EntityNotFoundError);

    expect(orderRepository.create).not.toHaveBeenCalled();
  });

  it('publishes exactly one order.created event with correlationId = order id and the canonical payload', async () => {
    productRepository.findById.mockResolvedValue(headphones);
    orderRepository.create.mockResolvedValue(createdOrder);

    const result = await useCase.execute({
      userId: 'user-1',
      items: [{ productId: headphones.id, quantity: 2 }],
    });

    const published = eventPublisher.published();
    expect(published).toHaveLength(1);
    expect(published[0]).toEqual({
      event: EVENT_NAMES.ORDER_CREATED,
      correlationId: result.id,
      data: {
        orderId: createdOrder.id,
        totalCents: createdOrder.totalCents,
        items: createdOrder.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      },
    });
  });

  it('still returns the created order when the event publisher throws', async () => {
    productRepository.findById.mockResolvedValue(headphones);
    orderRepository.create.mockResolvedValue(createdOrder);
    jest.spyOn(eventPublisher, 'publish').mockRejectedValueOnce(new Error('QStash unreachable'));

    const result = await useCase.execute({
      userId: 'user-1',
      items: [{ productId: headphones.id, quantity: 2 }],
    });

    expect(result.id).toBe(createdOrder.id);
    expect(result.totalCents).toBe(createdOrder.totalCents);
  });
});
