import { OrderWithCustomer } from '../../../domain/orders/order.entity';
import { OrderRepository } from '../ports/order-repository.port';
import { MockedPort } from '../../../test/mocked-port';
import { ListAllOrdersUseCase } from './list-all-orders.use-case';

describe('ListAllOrdersUseCase', () => {
  const order: OrderWithCustomer = {
    id: 'order-1',
    userId: 'user-1',
    userEmail: 'customer@example.com',
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
  let useCase: ListAllOrdersUseCase;

  beforeEach(() => {
    orderRepository = {
      create: jest.fn(),
      list: jest.fn(),
      findByIdForUser: jest.fn(),
      findById: jest.fn(),
      updateStatus: jest.fn(),
      listAll: jest.fn(),
      findByIdWithUser: jest.fn(),
    };
    useCase = new ListAllOrdersUseCase(orderRepository);
  });

  it('lists orders across every customer with default pagination and no status filter', async () => {
    orderRepository.listAll.mockResolvedValue({ items: [order], total: 1 });

    const result = await useCase.execute({});

    expect(orderRepository.listAll).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      status: undefined,
    });
    expect(result.items).toEqual([
      {
        id: order.id,
        status: order.status,
        totalCents: order.totalCents,
        itemCount: 1,
        createdAt: order.createdAt,
        userId: order.userId,
        userEmail: order.userEmail,
      },
    ]);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('clamps page < 1 to 1 and limit above 100 to 100', async () => {
    orderRepository.listAll.mockResolvedValue({ items: [], total: 0 });

    await useCase.execute({ page: -5, limit: 500 });

    expect(orderRepository.listAll).toHaveBeenCalledWith({
      page: 1,
      limit: 100,
      status: undefined,
    });
  });

  it('passes through an explicit status filter', async () => {
    orderRepository.listAll.mockResolvedValue({ items: [], total: 0 });

    await useCase.execute({ status: 'PAID' });

    expect(orderRepository.listAll).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      status: 'PAID',
    });
  });
});
