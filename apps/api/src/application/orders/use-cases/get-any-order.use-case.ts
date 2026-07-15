import { Injectable } from '@nestjs/common';
import { EntityNotFoundError } from '../../../domain/errors';
import { OrderRepository } from '../ports/order-repository.port';
import { AdminOrderOutput, toAdminOrderOutput } from './order-output';

/**
 * Looks up a single order with its full line items, unscoped by `userId`.
 * ADMIN-only: reachable exclusively from `AdminOrdersController`, gated by
 * `RolesGuard` + `@Roles(ADMIN)`.
 *
 * Kept as a separate use case from `GetOrderUseCase` rather than adding an
 * "admin mode" flag to it: the two have different repository calls
 * (`findByIdWithUser` vs. `findByIdForUser`), different output shapes
 * (`AdminOrderOutput` vs. `OrderOutput`), and different authorization
 * models (no `userId` scoping at all vs. always-scoped) — branching a single
 * use case on a boolean would obscure that distinction rather than clarify
 * it, and would risk the ADMIN branch accidentally becoming reachable from
 * the customer-facing route.
 */
@Injectable()
export class GetAnyOrderUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(orderId: string): Promise<AdminOrderOutput> {
    const order = await this.orderRepository.findByIdWithUser(orderId);
    if (!order) {
      throw new EntityNotFoundError('Order', orderId);
    }
    return toAdminOrderOutput(order);
  }
}
