import { Order } from '../../../domain/orders/order.entity';
import { ProcessedEventRepository } from '../../ports/processed-event-repository.port';
import { OrderRepository } from '../ports/order-repository.port';
import { MockedPort } from '../../../test/mocked-port';
import { HandlePaymentEventUseCase } from './handle-payment-event.use-case';

describe('HandlePaymentEventUseCase', () => {
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

  let processedEventRepository: MockedPort<ProcessedEventRepository>;
  let orderRepository: MockedPort<OrderRepository>;
  let useCase: HandlePaymentEventUseCase;

  beforeEach(() => {
    processedEventRepository = {
      tryClaim: jest.fn(),
    };
    orderRepository = {
      create: jest.fn(),
      list: jest.fn(),
      findByIdForUser: jest.fn(),
      findById: jest.fn(),
      updateStatus: jest.fn(),
    };
    useCase = new HandlePaymentEventUseCase(processedEventRepository, orderRepository);
  });

  it('transitions a known order to PAID on payment.completed', async () => {
    processedEventRepository.tryClaim.mockResolvedValue(true);
    orderRepository.findById.mockResolvedValue(order);
    orderRepository.updateStatus.mockResolvedValue({ ...order, status: 'PAID' });

    await useCase.execute('payment.completed', order.id, order.id);

    expect(processedEventRepository.tryClaim).toHaveBeenCalledWith('order-1', 'payment.completed');
    expect(orderRepository.findById).toHaveBeenCalledWith(order.id);
    expect(orderRepository.updateStatus).toHaveBeenCalledWith(order.id, 'PAID');
  });

  it('transitions a known order to PAYMENT_FAILED on payment.failed', async () => {
    processedEventRepository.tryClaim.mockResolvedValue(true);
    orderRepository.findById.mockResolvedValue(order);
    orderRepository.updateStatus.mockResolvedValue({ ...order, status: 'PAYMENT_FAILED' });

    await useCase.execute('payment.failed', order.id, order.id);

    expect(orderRepository.updateStatus).toHaveBeenCalledWith(order.id, 'PAYMENT_FAILED');
  });

  it('does nothing when the event was already processed (redelivery)', async () => {
    processedEventRepository.tryClaim.mockResolvedValue(false);

    await useCase.execute('payment.completed', order.id, order.id);

    expect(orderRepository.findById).not.toHaveBeenCalled();
    expect(orderRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('acknowledges without throwing when the order id is unknown', async () => {
    processedEventRepository.tryClaim.mockResolvedValue(true);
    orderRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('payment.completed', 'missing-order', 'missing-order'),
    ).resolves.toBeUndefined();

    expect(orderRepository.updateStatus).not.toHaveBeenCalled();
  });
});
