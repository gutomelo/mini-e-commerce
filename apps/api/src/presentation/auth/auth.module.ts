import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PasswordHasherPort } from '../../application/auth/ports/password-hasher.port';
import { RefreshTokenRepository } from '../../application/auth/ports/refresh-token-repository.port';
import { TokenServicePort } from '../../application/auth/ports/token-service.port';
import { UserRepository } from '../../application/auth/ports/user-repository.port';
import { LoginUseCase } from '../../application/auth/use-cases/login.use-case';
import { LogoutUseCase } from '../../application/auth/use-cases/logout.use-case';
import { RefreshTokensUseCase } from '../../application/auth/use-cases/refresh-tokens.use-case';
import { RegisterUserUseCase } from '../../application/auth/use-cases/register-user.use-case';
import { BcryptPasswordHasher } from '../../infrastructure/auth/bcrypt-password-hasher';
import { JwtTokenService } from '../../infrastructure/auth/jwt-token.service';
import { PrismaRefreshTokenRepository } from '../../infrastructure/auth/repositories/prisma-refresh-token.repository';
import { PrismaUserRepository } from '../../infrastructure/auth/repositories/prisma-user.repository';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

/**
 * Wires the auth feature end to end: ports are bound to their Prisma/bcrypt/
 * JWT adapters here (the only place infrastructure classes are referenced
 * outside `infrastructure/`), so use cases and the controller only ever see
 * interfaces.
 *
 * `JwtAuthGuard` and `RolesGuard` are exported so other feature modules
 * (users, products, categories) can apply `@UseGuards(JwtAuthGuard, RolesGuard)`
 * and `@Roles(...)` without re-implementing token verification.
 * `UserRepository` is exported so `UsersModule` can reuse the same
 * `PrismaUserRepository` binding without re-registering it.
 */
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    { provide: UserRepository, useClass: PrismaUserRepository },
    { provide: RefreshTokenRepository, useClass: PrismaRefreshTokenRepository },
    { provide: PasswordHasherPort, useClass: BcryptPasswordHasher },
    { provide: TokenServicePort, useClass: JwtTokenService },
    RegisterUserUseCase,
    LoginUseCase,
    RefreshTokensUseCase,
    LogoutUseCase,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [UserRepository, TokenServicePort, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
