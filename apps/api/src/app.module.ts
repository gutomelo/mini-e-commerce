import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health.controller';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { LoggerModule } from './infrastructure/logging/logger.module';
import { GlobalExceptionFilter } from './presentation/filters/global-exception.filter';

@Module({
  imports: [
    LoggerModule,
    PrismaModule,
    ThrottlerModule.forRoot([
      // Default bucket applied to every route unless overridden with @Throttle.
      { name: 'default', ttl: 60_000, limit: 100 },
      // Stricter bucket reserved for auth endpoints (task #40 references it
      // via `@Throttle({ auth: { limit: 10, ttl: 60000 } })`).
      { name: 'auth', ttl: 60_000, limit: 10 },
    ]),
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
