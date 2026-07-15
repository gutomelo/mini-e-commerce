import { Module } from '@nestjs/common';
import { OrderRepository } from '../../application/orders/ports/order-repository.port';
import { CreateOrderUseCase } from '../../application/orders/use-cases/create-order.use-case';
import { GetOrderUseCase } from '../../application/orders/use-cases/get-order.use-case';
import { ListOrdersUseCase } from '../../application/orders/use-cases/list-orders.use-case';
import { PrismaOrderRepository } from '../../infrastructure/orders/repositories/prisma-order.repository';
import { AuthModule } from '../auth/auth.module';
import { ProductsModule } from '../products/products.module';
import { OrdersController } from './orders.controller';

/**
 * Imports `AuthModule` to reuse its `JwtAuthGuard` binding for the
 * authenticated-only order endpoints, and `ProductsModule` to reuse its
 * `ProductRepository` binding for re-pricing/validating order line items
 * without re-registering the Prisma adapter.
 */
@Module({
  imports: [AuthModule, ProductsModule],
  controllers: [OrdersController],
  providers: [
    { provide: OrderRepository, useClass: PrismaOrderRepository },
    CreateOrderUseCase,
    ListOrdersUseCase,
    GetOrderUseCase,
  ],
  exports: [OrderRepository],
})
export class OrdersModule {}
