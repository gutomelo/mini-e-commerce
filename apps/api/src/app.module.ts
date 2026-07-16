import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health.controller';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { LoggerModule } from './infrastructure/logging/logger.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { EventsModule } from './infrastructure/events/events.module';
import { GlobalExceptionFilter } from './presentation/filters/global-exception.filter';
import { AuthModule } from './presentation/auth/auth.module';
import { UsersModule } from './presentation/users/users.module';
import { CategoriesModule } from './presentation/categories/categories.module';
import { ProductsModule } from './presentation/products/products.module';
import { OrdersModule } from './presentation/orders/orders.module';
import { EventsPresentationModule } from './presentation/events/events.module';
import { InventoryModule } from './presentation/inventory/inventory.module';

function resolveAuthThrottleLimit(): number {
  const raw = Number(process.env.AUTH_THROTTLE_LIMIT);
  return Number.isFinite(raw) && raw >= 0 ? raw : 10;
}

@Module({
  imports: [
    LoggerModule,
    PrismaModule,
    CacheModule,
    EventsModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    ProductsModule,
    OrdersModule,
    EventsPresentationModule,
    InventoryModule,
    ThrottlerModule.forRoot([
      // Default bucket applied to every route unless overridden with @Throttle.
      { name: 'default', ttl: 60_000, limit: 100 },
      // Stricter bucket reserved for auth endpoints (task #40 references it
      // via `@Throttle({ auth: { limit: 10, ttl: 60000 } })`). Overridable via
      // `AUTH_THROTTLE_LIMIT` (falls back to the production default of 10)
      // so the storefront's Playwright e2e suite — which legitimately issues
      // more than 10 auth calls per run across its scenarios, all from the
      // same loopback address — can raise it for its own spawned API
      // instance without changing prod/dev behavior or the API's own
      // `test:e2e` suite, which never sets this variable.
      { name: 'auth', ttl: 60_000, limit: resolveAuthThrottleLimit() },
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
