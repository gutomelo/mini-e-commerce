import { EntityNotFoundError } from '../../../domain/errors';
import { Order } from '../../../domain/orders/order.entity';
import { OrderRepository } from '../ports/order-repository.port';
import { MockedPort } from '../../../test/mocked-port';
import { GetOrderUseCase } from './get-order.use-case';

describe('GetOrderUseCase', () => {
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
  let useCase: GetOrderUseCase;

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
    useCase = new GetOrderUseCase(orderRepository);
  });

  it('returns the full order with items when it belongs to the requesting user', async () => {
    orderRepository.findByIdForUser.mockResolvedValue(order);

    const result = await useCase.execute(order.id, 'user-1');

    expect(orderRepository.findByIdForUser).toHaveBeenCalledWith(order.id, 'user-1');
    expect(result.id).toBe(order.id);
    expect(result.items).toEqual([
      { productId: 'product-1', productName: 'Headphones', unitPriceCents: 12999, quantity: 1 },
    ]);
  });

  it('throws EntityNotFoundError when the order does not exist', async () => {
    orderRepository.findByIdForUser.mockResolvedValue(null);

    await expect(useCase.execute('missing-order', 'user-1')).rejects.toBeInstanceOf(
      EntityNotFoundError,
    );
  });

  it('throws EntityNotFoundError (not a different error) when the order belongs to another user', async () => {
    // The repository itself returns null for a foreign order id — the use
    // case cannot distinguish "does not exist" from "belongs to someone
    // else", which is the point: existence is never leaked cross-user.
    orderRepository.findByIdForUser.mockResolvedValue(null);

    await expect(useCase.execute(order.id, 'other-user')).rejects.toBeInstanceOf(
      EntityNotFoundError,
    );
    expect(orderRepository.findByIdForUser).toHaveBeenCalledWith(order.id, 'other-user');
  });
});
