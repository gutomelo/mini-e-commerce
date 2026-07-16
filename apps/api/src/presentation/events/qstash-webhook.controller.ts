import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { EVENT_NAMES } from '@mini-e-commerce/types';
import { HandlePaymentEventUseCase } from '../../application/orders/use-cases/handle-payment-event.use-case';
import { QStashEventDto } from './dto/qstash-event.dto';
import { QStashSignatureGuard } from './qstash-signature.guard';

const ACCEPTED_EVENTS = new Set<string>([
  EVENT_NAMES.PAYMENT_COMPLETED,
  EVENT_NAMES.PAYMENT_FAILED,
]);

/**
 * Consumes `payment.completed`/`payment.failed` webhooks delivered by
 * QStash. Authenticated via `QStashSignatureGuard` (the `Upstash-Signature`
 * header) rather than a user JWT — QStash is the only caller — so no
 * `JwtAuthGuard` is applied, matching `apps/inventory`'s and
 * `apps/payment`'s own webhook consumers.
 *
 * `QStashSignatureGuard` runs before Nest's pipes (guards precede pipes in
 * the request lifecycle), so an unsigned/invalidly-signed request is
 * rejected before `@Body() dto` ever triggers the global `ValidationPipe` —
 * an unauthenticated caller never sees DTO-shape validation errors.
 *
 * Still sits behind the app-wide `ThrottlerGuard` (default bucket), which is
 * generous enough for QStash's redelivery/retry traffic.
 */
@ApiExcludeController()
@Controller('events')
@UseGuards(QStashSignatureGuard)
export class QStashWebhookController {
  constructor(private readonly handlePaymentEventUseCase: HandlePaymentEventUseCase) {}

  @Post('qstash')
  async handle(@Body() dto: QStashEventDto): Promise<void> {
    if (!ACCEPTED_EVENTS.has(dto.event)) {
      throw new BadRequestException(`Unsupported event "${dto.event}"`);
    }

    const event = dto.event as
      typeof EVENT_NAMES.PAYMENT_COMPLETED | typeof EVENT_NAMES.PAYMENT_FAILED;
    await this.handlePaymentEventUseCase.execute(event, dto.correlationId, dto.data.orderId);
  }
}
