import { Module } from '@nestjs/common';
import { HandlePaymentEventUseCase } from '../../application/orders/use-cases/handle-payment-event.use-case';
import { QStashSignatureVerifier } from '../../infrastructure/events/qstash-signature-verifier';
import { OrdersModule } from '../orders/orders.module';
import { QStashSignatureGuard } from './qstash-signature.guard';
import { QStashWebhookController } from './qstash-webhook.controller';

/**
 * Presentation-layer module for the inbound QStash webhook
 * (`POST /api/v1/events/qstash`). Named distinctly from the infrastructure
 * `EventsModule` (which provides the outbound `EventPublisher`/
 * `ProcessedEventRepository` ports) to avoid a class-name collision.
 *
 * `ProcessedEventRepository` is already provided globally by the
 * infrastructure `EventsModule`. `OrderRepository` is provided by
 * `OrdersModule`, which is imported here (and now exports `OrderRepository`)
 * rather than re-registering `PrismaOrderRepository` a second time.
 */
@Module({
  imports: [OrdersModule],
  controllers: [QStashWebhookController],
  providers: [QStashSignatureVerifier, QStashSignatureGuard, HandlePaymentEventUseCase],
})
export class EventsPresentationModule {}
