import { Injectable } from '@nestjs/common';
import { ProductRepository } from '../../products/ports/product-repository.port';
import { EntityNotFoundError } from '../../../domain/errors';
import { NewOrderItem } from '../../../domain/orders/order.entity';
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
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly productRepository: ProductRepository,
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

    return toOrderOutput(order);
  }
}
