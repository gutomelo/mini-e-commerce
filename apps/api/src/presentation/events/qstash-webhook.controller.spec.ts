import { BadRequestException } from '@nestjs/common';
import { HandlePaymentEventUseCase } from '../../application/orders/use-cases/handle-payment-event.use-case';
import { QStashEventDto } from './dto/qstash-event.dto';
import { QStashWebhookController } from './qstash-webhook.controller';

// Signature verification is `QStashSignatureGuard`'s responsibility (see its
// own spec) — it runs before this controller's method via `@UseGuards`, so
// these tests exercise only what the controller itself does once a request
// has already passed the guard: event-type validation and delegation.

function buildDto(event: string, orderId = 'order-1'): QStashEventDto {
  const dto = new QStashEventDto();
  dto.event = event;
  dto.correlationId = orderId;
  dto.timestamp = new Date().toISOString();
  dto.data = { orderId };
  return dto;
}

describe('QStashWebhookController', () => {
  let handlePaymentEventUseCase: { execute: jest.Mock };
  let controller: QStashWebhookController;

  beforeEach(() => {
    handlePaymentEventUseCase = { execute: jest.fn() };
    controller = new QStashWebhookController(
      handlePaymentEventUseCase as unknown as HandlePaymentEventUseCase,
    );
  });

  it('rejects with 400 for an unsupported event value', async () => {
    await expect(controller.handle(buildDto('order.created'))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(handlePaymentEventUseCase.execute).not.toHaveBeenCalled();
  });

  it('delegates to HandlePaymentEventUseCase for payment.completed', async () => {
    const dto = buildDto('payment.completed', 'order-42');

    await controller.handle(dto);

    expect(handlePaymentEventUseCase.execute).toHaveBeenCalledWith(
      'payment.completed',
      'order-42',
      'order-42',
    );
  });

  it('delegates to HandlePaymentEventUseCase for payment.failed', async () => {
    const dto = buildDto('payment.failed', 'order-43');

    await controller.handle(dto);

    expect(handlePaymentEventUseCase.execute).toHaveBeenCalledWith(
      'payment.failed',
      'order-43',
      'order-43',
    );
  });
});
