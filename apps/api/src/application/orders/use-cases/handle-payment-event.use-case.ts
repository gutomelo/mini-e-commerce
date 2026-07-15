import { Injectable, Logger } from '@nestjs/common';
import { EVENT_NAMES } from '@mini-e-commerce/types';
import { OrderStatus } from '../../../domain/orders/order.entity';
import { ProcessedEventRepository } from '../../ports/processed-event-repository.port';
import { OrderRepository } from '../ports/order-repository.port';

type PaymentEvent = typeof EVENT_NAMES.PAYMENT_COMPLETED | typeof EVENT_NAMES.PAYMENT_FAILED;

const STATUS_BY_EVENT: Record<PaymentEvent, OrderStatus> = {
  [EVENT_NAMES.PAYMENT_COMPLETED]: 'PAID',
  [EVENT_NAMES.PAYMENT_FAILED]: 'PAYMENT_FAILED',
};

/**
 * Reacts to `payment.completed`/`payment.failed` events delivered by the
 * QStash webhook consumer, transitioning the corresponding order's status.
 *
 * Signature verification happens before this use case is invoked (the
 * webhook controller's responsibility) — `execute` assumes `event`,
 * `correlationId`, and `orderId` have already been authenticated and
 * parsed out of the inbound payload.
 *
 * Idempotency is enforced up front via `ProcessedEventRepository.tryClaim`:
 * QStash guarantees at-least-once delivery, so a redelivered event must be
 * a silent no-op rather than reprocessed or reported as an error.
 *
 * The claim and the status update are not wrapped in a single transaction
 * (same accepted tradeoff `apps/inventory`'s `ConsumeOrderCreatedUseCase`
 * documents): if this process crashes between the claim committing and
 * `updateStatus` completing, a QStash redelivery of the same event will see
 * it as already claimed and silently no-op, leaving the order stuck at its
 * prior status. This is a deliberate simplicity/portfolio-scope tradeoff,
 * not an oversight — revisit only if this ever needs a stronger guarantee.
 */
@Injectable()
export class HandlePaymentEventUseCase {
  private readonly logger = new Logger(HandlePaymentEventUseCase.name);

  constructor(
    private readonly processedEventRepository: ProcessedEventRepository,
    private readonly orderRepository: OrderRepository,
  ) {}

  async execute(event: PaymentEvent, correlationId: string, orderId: string): Promise<void> {
    const claimed = await this.processedEventRepository.tryClaim(correlationId, event);
    if (!claimed) {
      this.logger.log(
        `Ignoring redelivered ${event} for correlationId ${correlationId} (already processed)`,
      );
      return;
    }

    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      this.logger.warn(
        `Received ${event} for unknown order ${orderId}; acknowledging without action`,
      );
      return;
    }

    const newStatus = STATUS_BY_EVENT[event];
    await this.orderRepository.updateStatus(orderId, newStatus);

    this.logger.log(`Order ${orderId} transitioned ${order.status} -> ${newStatus} (${event})`);
  }
}
