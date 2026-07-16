import { Module } from '@nestjs/common';
import { OrderRepository } from '../../application/orders/ports/order-repository.port';
import { CreateOrderUseCase } from '../../application/orders/use-cases/create-order.use-case';
import { GetAnyOrderUseCase } from '../../application/orders/use-cases/get-any-order.use-case';
import { GetOrderUseCase } from '../../application/orders/use-cases/get-order.use-case';
import { ListAllOrdersUseCase } from '../../application/orders/use-cases/list-all-orders.use-case';
import { ListOrdersUseCase } from '../../application/orders/use-cases/list-orders.use-case';
import { PrismaOrderRepository } from '../../infrastructure/orders/repositories/prisma-order.repository';
import { AuthModule } from '../auth/auth.module';
import { ProductsModule } from '../products/products.module';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersController } from './orders.controller';

/**
 * Imports `AuthModule` to reuse its `JwtAuthGuard`/`RolesGuard` bindings for
 * the authenticated-only and ADMIN-only order endpoints, and `ProductsModule`
 * to reuse its `ProductRepository` binding for re-pricing/validating order
 * line items without re-registering the Prisma adapter.
 *
 * `AdminOrdersController` stays in this module rather than a new one: it is
 * still the Orders bounded context (same repository, same domain entity),
 * just an ADMIN-only, cross-customer view added in Phase 7.
 */
@Module({
  imports: [AuthModule, ProductsModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [
    { provide: OrderRepository, useClass: PrismaOrderRepository },
    CreateOrderUseCase,
    ListOrdersUseCase,
    GetOrderUseCase,
    ListAllOrdersUseCase,
    GetAnyOrderUseCase,
  ],
  exports: [OrderRepository],
})
export class OrdersModule {}
