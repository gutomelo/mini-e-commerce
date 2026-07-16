import { Injectable } from '@nestjs/common';
import { OrderStatus } from '../../../domain/orders/order.entity';
import { OrderRepository } from '../ports/order-repository.port';
import { AdminOrderSummaryOutput, toAdminOrderSummaryOutput } from './order-output';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;

/** Raw query input as received from the controller (unvalidated ranges; `status` already narrowed by the DTO's `@IsEnum`). */
export interface ListAllOrdersInput {
  page?: number;
  limit?: number;
  status?: OrderStatus;
}

export interface ListAllOrdersOutput {
  items: AdminOrderSummaryOutput[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Lists orders across every customer, paginated and sorted newest-first,
 * optionally filtered by `status`. ADMIN-only: reachable exclusively from
 * `AdminOrdersController`, gated by `RolesGuard` + `@Roles(ADMIN)`.
 *
 * Never cached — order data is transactional, not a read-only catalog
 * resource, so it is always served straight from Postgres (same rationale
 * as `ListOrdersUseCase`).
 */
@Injectable()
export class ListAllOrdersUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(input: ListAllOrdersInput): Promise<ListAllOrdersOutput> {
    const page =
      Number.isFinite(input.page) && (input.page as number) > 0
        ? Math.floor(input.page as number)
        : DEFAULT_PAGE;
    const rawLimit = Number.isFinite(input.limit)
      ? Math.floor(input.limit as number)
      : DEFAULT_LIMIT;
    const limit = Math.min(Math.max(rawLimit, MIN_LIMIT), MAX_LIMIT);

    const { items, total } = await this.orderRepository.listAll({
      page,
      limit,
      status: input.status,
    });

    return {
      items: items.map(toAdminOrderSummaryOutput),
      total,
      page,
      limit,
    };
  }
}
