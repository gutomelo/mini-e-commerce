import { Order } from '../../../domain/orders/order.entity';
import { OrderRepository } from '../ports/order-repository.port';
import { MockedPort } from '../../../test/mocked-port';
import { ListOrdersUseCase } from './list-orders.use-case';

describe('ListOrdersUseCase', () => {
  const order: Order = {
    id: 'order-1',
    userId: 'user-1',
    status: 'PLACED',
    totalCents: 12999,
    items: [
      {
        id: 'item-1',
        productId: 'product-1',
        productName: 'Headphones',
        unitPriceCents: 12999,
        quantity: 1,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let orderRepository: MockedPort<OrderRepository>;
  let useCase: ListOrdersUseCase;

  beforeEach(() => {
    orderRepository = {
      create: jest.fn(),
      list: jest.fn(),
      findByIdForUser: jest.fn(),
      findById: jest.fn(),
      updateStatus: jest.fn(),
    };
    useCase = new ListOrdersUseCase(orderRepository);
  });

  it('lists orders scoped to the given user with default pagination', async () => {
    orderRepository.list.mockResolvedValue({ items: [order], total: 1 });

    const result = await useCase.execute('user-1', {});

    expect(orderRepository.list).toHaveBeenCalledWith('user-1', { page: 1, limit: 20 });
    expect(result.items).toEqual([
      {
        id: order.id,
        status: order.status,
        totalCents: order.totalCents,
        itemCount: 1,
        createdAt: order.createdAt,
      },
    ]);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('clamps page < 1 to 1 and limit above 100 to 100', async () => {
    orderRepository.list.mockResolvedValue({ items: [], total: 0 });

    await useCase.execute('user-1', { page: -5, limit: 500 });

    expect(orderRepository.list).toHaveBeenCalledWith('user-1', { page: 1, limit: 100 });
  });

  it('passes through explicit page/limit values', async () => {
    orderRepository.list.mockResolvedValue({ items: [], total: 0 });

    await useCase.execute('user-1', { page: 2, limit: 10 });

    expect(orderRepository.list).toHaveBeenCalledWith('user-1', { page: 2, limit: 10 });
  });
});
