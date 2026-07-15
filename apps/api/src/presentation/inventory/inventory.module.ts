import { Module } from '@nestjs/common';
import { GetStockUseCase } from '../../application/inventory/use-cases/get-stock.use-case';
import { SetStockUseCase } from '../../application/inventory/use-cases/set-stock.use-case';
import { InventoryInfrastructureModule } from '../../infrastructure/inventory/inventory-infrastructure.module';
import { AuthModule } from '../auth/auth.module';
import { InventoryController } from './inventory.controller';

/**
 * Imports `AuthModule` to reuse its `JwtAuthGuard`/`RolesGuard` bindings and
 * `InventoryInfrastructureModule` for the `InventoryClient` binding
 * (`HttpInventoryClient` proxying to `apps/inventory`).
 */
@Module({
  imports: [AuthModule, InventoryInfrastructureModule],
  controllers: [InventoryController],
  providers: [GetStockUseCase, SetStockUseCase],
})
export class InventoryModule {}
