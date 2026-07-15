import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { EVENT_NAMES } from '@mini-e-commerce/types';
import { HandlePaymentEventUseCase } from '../../application/orders/use-cases/handle-payment-event.use-case';
import { QStashSignatureVerifier } from '../../infrastructure/events/qstash-signature-verifier';
import { QStashEventDto } from './dto/qstash-event.dto';

const ACCEPTED_EVENTS = new Set<string>([
  EVENT_NAMES.PAYMENT_COMPLETED,
  EVENT_NAMES.PAYMENT_FAILED,
]);

/**
 * Consumes `payment.completed`/`payment.failed` webhooks delivered by
 * QStash. Authenticated via the `Upstash-Signature` header rather than a
 * user JWT — QStash is the only caller — so no `JwtAuthGuard` is applied,
 * matching `apps/inventory`'s and `apps/payment`'s own webhook consumers.
 *
 * Still sits behind the app-wide `ThrottlerGuard` (default bucket), which is
 * generous enough for QStash's redelivery/retry traffic.
 */
@ApiExcludeController()
@Controller('events')
export class QStashWebhookController {
  constructor(
    private readonly signatureVerifier: QStashSignatureVerifier,
    private readonly handlePaymentEventUseCase: HandlePaymentEventUseCase,
  ) {}

  @Post('qstash')
  async handle(
    @Req() request: RawBodyRequest<Request>,
    @Body() dto: QStashEventDto,
  ): Promise<void> {
    const signature = request.headers['upstash-signature'];
    const rawBody = request.rawBody?.toString('utf-8');

    if (typeof signature !== 'string' || !rawBody) {
      throw new UnauthorizedException('Missing Upstash-Signature or request body');
    }

    const verified = await this.signatureVerifier.verify(signature, rawBody);
    if (!verified) {
      throw new UnauthorizedException('Invalid Upstash-Signature');
    }

    if (!ACCEPTED_EVENTS.has(dto.event)) {
      throw new BadRequestException(`Unsupported event "${dto.event}"`);
    }

    const event = dto.event as
      typeof EVENT_NAMES.PAYMENT_COMPLETED | typeof EVENT_NAMES.PAYMENT_FAILED;
    await this.handlePaymentEventUseCase.execute(event, dto.correlationId, dto.data.orderId);
  }
}
