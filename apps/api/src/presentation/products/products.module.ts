import { Module } from '@nestjs/common';
import { CreateProductUseCase } from '../../application/products/use-cases/create-product.use-case';
import { DeleteProductUseCase } from '../../application/products/use-cases/delete-product.use-case';
import { GetProductUseCase } from '../../application/products/use-cases/get-product.use-case';
import { ListProductsUseCase } from '../../application/products/use-cases/list-products.use-case';
import { UpdateProductUseCase } from '../../application/products/use-cases/update-product.use-case';
import { ProductRepository } from '../../application/products/ports/product-repository.port';
import { PrismaProductRepository } from '../../infrastructure/products/repositories/prisma-product.repository';
import { AuthModule } from '../auth/auth.module';
import { CategoriesModule } from '../categories/categories.module';
import { ProductsController } from './products.controller';

/**
 * Imports `AuthModule` to reuse its `JwtAuthGuard`/`RolesGuard` bindings for
 * the ADMIN-only write endpoints, and `CategoriesModule` to reuse its
 * `CategoryRepository` binding for validating `categoryId` on create/update
 * without re-registering the Prisma adapter. `CachePort` is bound globally
 * by `CacheModule` and does not need to be re-imported here.
 *
 * `ProductRepository` is exported so `OrdersModule` can reuse the same
 * `PrismaProductRepository` binding to re-price/validate order line items
 * without re-registering it.
 */
@Module({
  imports: [AuthModule, CategoriesModule],
  controllers: [ProductsController],
  providers: [
    { provide: ProductRepository, useClass: PrismaProductRepository },
    ListProductsUseCase,
    GetProductUseCase,
    CreateProductUseCase,
    UpdateProductUseCase,
    DeleteProductUseCase,
  ],
  exports: [ProductRepository],
})
export class ProductsModule {}
