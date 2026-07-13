import { Module } from '@nestjs/common';
import { GetProfileUseCase } from '../../application/users/use-cases/get-profile.use-case';
import { AuthModule } from '../auth/auth.module';
import { UsersController } from './users.controller';

/**
 * Imports `AuthModule` to reuse its `UserRepository` binding (Prisma
 * adapter) and `JwtAuthGuard` rather than re-registering either.
 */
@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [GetProfileUseCase],
})
export class UsersModule {}
