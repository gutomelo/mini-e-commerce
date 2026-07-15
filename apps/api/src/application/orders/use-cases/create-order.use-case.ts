import { Injectable, Logger } from '@nestjs/common';
import { EVENT_NAMES } from '@mini-e-commerce/types';
import { ProductRepository } from '../../products/ports/product-repository.port';
import { EntityNotFoundError } from '../../../domain/errors';
import { NewOrderItem, OrderItem } from '../../../domain/orders/order.entity';
import { EventPublisher } from '../../ports/event-publisher.port';
import { OrderRepository } from '../ports/order-repository.port';
import { OrderOutput, toOrderOutput } from './order-output';

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
}

export interface CreateOrderInput {
  userId: string;
  items: CreateOrderItemInput[];
}

/**
 * Creates an order for the authenticated user. Re-prices every requested
 * item from the current `Product` record rather than trusting any
 * client-supplied price — the storefront's Server Action does its own
 * client-side check before calling this endpoint, but this use case is the
 * authoritative source of truth, so a missing or inactive product is
 * rejected outright (`EntityNotFoundError` naming the offending product id)
 * rather than silently dropped from the order.
 *
 * `ProductRepository.findById` already filters out soft-deleted
 * (`isActive: false`) products, so an inactive product looks identical to
 * a nonexistent one here.
 */
@Injectable()
export class CreateOrderUseCase {
  private readonly logger = new Logger(CreateOrderUseCase.name);

  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly productRepository: ProductRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: CreateOrderInput): Promise<OrderOutput> {
    const items: NewOrderItem[] = [];
    for (const requested of input.items) {
      const product = await this.productRepository.findById(requested.productId);
      if (!product) {
        throw new EntityNotFoundError('Product', requested.productId);
      }
      items.push({
        productId: product.id,
        productName: product.name,
        unitPriceCents: product.priceCents,
        quantity: requested.quantity,
      });
    }

    const totalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);

    const order = await this.orderRepository.create({
      userId: input.userId,
      totalCents,
      items,
    });

    await this.publishOrderCreated(order.id, order.totalCents, order.items);

    return toOrderOutput(order);
  }

  /**
   * Publishes `order.created` using the new order's own id as the
   * `correlationId`, giving every downstream consumer (`apps/inventory`,
   * `apps/payment`) a single traceable identifier for the whole order
   * lifecycle. Best-effort: `EventPublisher` implementations already never
   * reject, but this catch is a defensive guard so a publish failure can
   * never affect the already-committed order or the HTTP response.
   */
  private async publishOrderCreated(
    orderId: string,
    totalCents: number,
    items: OrderItem[],
  ): Promise<void> {
    try {
      await this.eventPublisher.publish(EVENT_NAMES.ORDER_CREATED, orderId, {
        orderId,
        totalCents,
        items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      });
    } catch (error) {
      this.logger.error(
        `Failed to publish ${EVENT_NAMES.ORDER_CREATED} for order ${orderId}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
