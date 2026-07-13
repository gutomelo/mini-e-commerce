import { Injectable } from '@nestjs/common';
import { OrderRepository } from '../ports/order-repository.port';
import { OrderSummaryOutput, toOrderSummaryOutput } from './order-output';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;

/** Raw query input as received from the controller (unvalidated ranges). */
export interface ListOrdersInput {
  page?: number;
  limit?: number;
}

export interface ListOrdersOutput {
  items: OrderSummaryOutput[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Lists the authenticated user's own orders, paginated and sorted
 * newest-first. Never cached — order data is transactional, not a read-only
 * catalog resource, so it is always served straight from Postgres.
 */
@Injectable()
export class ListOrdersUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(userId: string, input: ListOrdersInput): Promise<ListOrdersOutput> {
    const page =
      Number.isFinite(input.page) && (input.page as number) > 0
        ? Math.floor(input.page as number)
        : DEFAULT_PAGE;
    const rawLimit = Number.isFinite(input.limit)
      ? Math.floor(input.limit as number)
      : DEFAULT_LIMIT;
    const limit = Math.min(Math.max(rawLimit, MIN_LIMIT), MAX_LIMIT);

    const { items, total } = await this.orderRepository.list(userId, { page, limit });

    return {
      items: items.map(toOrderSummaryOutput),
      total,
      page,
      limit,
    };
  }
}
