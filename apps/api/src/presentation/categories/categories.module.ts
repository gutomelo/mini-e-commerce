import { Module } from '@nestjs/common';
import { CategoryRepository } from '../../application/categories/ports/category-repository.port';
import { CreateCategoryUseCase } from '../../application/categories/use-cases/create-category.use-case';
import { DeleteCategoryUseCase } from '../../application/categories/use-cases/delete-category.use-case';
import { ListCategoriesUseCase } from '../../application/categories/use-cases/list-categories.use-case';
import { UpdateCategoryUseCase } from '../../application/categories/use-cases/update-category.use-case';
import { PrismaCategoryRepository } from '../../infrastructure/categories/repositories/prisma-category.repository';
import { AuthModule } from '../auth/auth.module';
import { CategoriesController } from './categories.controller';

/**
 * Imports `AuthModule` to reuse its `JwtAuthGuard`/`RolesGuard` bindings for
 * the ADMIN-only write endpoints. `CachePort` is bound globally by
 * `CacheModule` and does not need to be re-imported here.
 *
 * `CategoryRepository` is exported so `ProductsModule` can reuse the same
 * `PrismaCategoryRepository` binding to validate `categoryId` on product
 * create/update without re-registering it.
 */
@Module({
  imports: [AuthModule],
  controllers: [CategoriesController],
  providers: [
    { provide: CategoryRepository, useClass: PrismaCategoryRepository },
    ListCategoriesUseCase,
    CreateCategoryUseCase,
    UpdateCategoryUseCase,
    DeleteCategoryUseCase,
  ],
  exports: [CategoryRepository],
})
export class CategoriesModule {}
