import { Injectable } from '@nestjs/common';
import { EntityNotFoundError } from '../../../domain/errors';
import { OrderRepository } from '../ports/order-repository.port';
import { OrderOutput, toOrderOutput } from './order-output';

/**
 * Looks up a single order with its full line items, scoped to the
 * authenticated user. `OrderRepository.findByIdForUser` returns `null` both
 * when the id does not exist at all and when it belongs to a different
 * user, so this use case raises the identical `EntityNotFoundError` (404)
 * in both cases — existence of another user's order is never leaked.
 */
@Injectable()
export class GetOrderUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(orderId: string, userId: string): Promise<OrderOutput> {
    const order = await this.orderRepository.findByIdForUser(orderId, userId);
    if (!order) {
      throw new EntityNotFoundError('Order', orderId);
    }
    return toOrderOutput(order);
  }
}
