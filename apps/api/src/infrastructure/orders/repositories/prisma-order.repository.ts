import { Injectable } from '@nestjs/common';
import { OrderRepository } from '../../../application/orders/ports/order-repository.port';
import {
  NewOrder,
  Order,
  OrderListFilter,
  OrderListResult,
} from '../../../domain/orders/order.entity';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  Order as PrismaOrder,
  OrderItem as PrismaOrderItem,
} from '../../../generated/prisma/client';

type PrismaOrderWithItems = PrismaOrder & { items: PrismaOrderItem[] };

@Injectable()
export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persists the order and its line items in a single nested write so it is
   * never possible to end up with an `Order` row and no `OrderItem` rows
   * (or vice versa) if something fails partway.
   */
  async create(order: NewOrder): Promise<Order> {
    const record = await this.prisma.order.create({
      data: {
        userId: order.userId,
        totalCents: order.totalCents,
        items: {
          create: order.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            unitPriceCents: item.unitPriceCents,
            quantity: item.quantity,
          })),
        },
      },
      include: { items: true },
    });
    return toDomain(record);
  }

  async list(userId: string, filter: OrderListFilter): Promise<OrderListResult> {
    const where = { userId };

    const [records, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items: records.map(toDomain), total };
  }

  async findByIdForUser(id: string, userId: string): Promise<Order | null> {
    const record = await this.prisma.order.findFirst({
      where: { id, userId },
      include: { items: true },
    });
    return record ? toDomain(record) : null;
  }
}

function toDomain(record: PrismaOrderWithItems): Order {
  return {
    id: record.id,
    userId: record.userId,
    status: record.status,
    totalCents: record.totalCents,
    items: record.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
    })),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
