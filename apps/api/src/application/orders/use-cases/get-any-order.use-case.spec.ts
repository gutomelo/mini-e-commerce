import { EntityNotFoundError } from '../../../domain/errors';
import { OrderWithCustomer } from '../../../domain/orders/order.entity';
import { OrderRepository } from '../ports/order-repository.port';
import { MockedPort } from '../../../test/mocked-port';
import { GetAnyOrderUseCase } from './get-any-order.use-case';

describe('GetAnyOrderUseCase', () => {
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
  let useCase: GetAnyOrderUseCase;

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
    useCase = new GetAnyOrderUseCase(orderRepository);
  });

  it("returns any customer's order with items, userId, and userEmail", async () => {
    orderRepository.findByIdWithUser.mockResolvedValue(order);

    const result = await useCase.execute(order.id);

    expect(orderRepository.findByIdWithUser).toHaveBeenCalledWith(order.id);
    expect(result.id).toBe(order.id);
    expect(result.userId).toBe(order.userId);
    expect(result.userEmail).toBe(order.userEmail);
    expect(result.items).toEqual([
      { productId: 'product-1', productName: 'Headphones', unitPriceCents: 12999, quantity: 1 },
    ]);
  });

  it('throws EntityNotFoundError when the order does not exist', async () => {
    orderRepository.findByIdWithUser.mockResolvedValue(null);

    await expect(useCase.execute('missing-order')).rejects.toBeInstanceOf(EntityNotFoundError);
  });
});
