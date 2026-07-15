import { Injectable } from '@nestjs/common';
import { OrderRepository } from '../../../application/orders/ports/order-repository.port';
import {
  AdminOrderListFilter,
  AdminOrderListResult,
  NewOrder,
  Order,
  OrderListFilter,
  OrderListResult,
  OrderStatus,
  OrderWithCustomer,
} from '../../../domain/orders/order.entity';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  Order as PrismaOrder,
  OrderItem as PrismaOrderItem,
  User as PrismaUser,
} from '../../../generated/prisma/client';

type PrismaOrderWithItems = PrismaOrder & { items: PrismaOrderItem[] };
type PrismaOrderWithItemsAndUser = PrismaOrderWithItems & { user: Pick<PrismaUser, 'email'> };

/** The `OrderStatus` values Prisma's generated enum accepts, used to validate an untrusted status string. */
const ORDER_STATUSES: readonly OrderStatus[] = ['PLACED', 'PAID', 'PAYMENT_FAILED'];

function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

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

  async findById(id: string): Promise<Order | null> {
    const record = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    return record ? toDomain(record) : null;
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const record = await this.prisma.order.update({
      where: { id },
      data: { status },
      include: { items: true },
    });
    return toDomain(record);
  }

  async listAll(filter: AdminOrderListFilter): Promise<AdminOrderListResult> {
    // `filter.status` is already typed as `OrderStatus | undefined` by the
    // time it reaches this port, but the guard below is kept as a defensive,
    // fail-loud check rather than trusting the type at the persistence
    // boundary: an invalid value is rejected with a clear error instead of
    // being silently ignored (matching all rows) or crashing inside Prisma.
    const rawStatus: string | undefined = filter.status;
    if (rawStatus !== undefined && !isOrderStatus(rawStatus)) {
      throw new Error(`Invalid order status filter: "${rawStatus}"`);
    }
    const where = filter.status ? { status: filter.status } : {};

    const [records, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true, user: { select: { email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items: records.map(toDomainWithUser), total };
  }

  async findByIdWithUser(id: string): Promise<OrderWithCustomer | null> {
    const record = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true, user: { select: { email: true } } },
    });
    return record ? toDomainWithUser(record) : null;
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

function toDomainWithUser(record: PrismaOrderWithItemsAndUser): OrderWithCustomer {
  return { ...toDomain(record), userEmail: record.user.email };
}
