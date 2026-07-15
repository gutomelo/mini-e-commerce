import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { HandlePaymentEventUseCase } from '../../application/orders/use-cases/handle-payment-event.use-case';
import { QStashSignatureVerifier } from '../../infrastructure/events/qstash-signature-verifier';
import { QStashEventDto } from './dto/qstash-event.dto';
import { QStashWebhookController } from './qstash-webhook.controller';

function buildRequest(
  signature: string | undefined,
  rawBody: string | undefined,
): RawBodyRequest<Request> {
  return {
    headers: signature === undefined ? {} : { 'upstash-signature': signature },
    rawBody: rawBody === undefined ? undefined : Buffer.from(rawBody, 'utf-8'),
  } as unknown as RawBodyRequest<Request>;
}

function buildDto(event: string, orderId = 'order-1'): QStashEventDto {
  const dto = new QStashEventDto();
  dto.event = event;
  dto.correlationId = orderId;
  dto.timestamp = new Date().toISOString();
  dto.data = { orderId };
  return dto;
}

describe('QStashWebhookController', () => {
  let signatureVerifier: { verify: jest.Mock };
  let handlePaymentEventUseCase: { execute: jest.Mock };
  let controller: QStashWebhookController;

  beforeEach(() => {
    signatureVerifier = { verify: jest.fn() };
    handlePaymentEventUseCase = { execute: jest.fn() };
    controller = new QStashWebhookController(
      signatureVerifier as unknown as QStashSignatureVerifier,
      handlePaymentEventUseCase as unknown as HandlePaymentEventUseCase,
    );
  });

  it('rejects with 401 when the Upstash-Signature header is missing', async () => {
    const request = buildRequest(undefined, '{}');

    await expect(controller.handle(request, buildDto('payment.completed'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(signatureVerifier.verify).not.toHaveBeenCalled();
    expect(handlePaymentEventUseCase.execute).not.toHaveBeenCalled();
  });

  it('rejects with 401 when the raw body is unavailable', async () => {
    const request = buildRequest('sig-1', undefined);

    await expect(controller.handle(request, buildDto('payment.completed'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(signatureVerifier.verify).not.toHaveBeenCalled();
  });

  it('rejects with 401 when the signature does not verify', async () => {
    signatureVerifier.verify.mockResolvedValue(false);
    const request = buildRequest('bad-sig', '{}');

    await expect(controller.handle(request, buildDto('payment.completed'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(handlePaymentEventUseCase.execute).not.toHaveBeenCalled();
  });

  it('rejects with 400 for an unsupported event value after a valid signature', async () => {
    signatureVerifier.verify.mockResolvedValue(true);
    const request = buildRequest('good-sig', '{}');

    await expect(controller.handle(request, buildDto('order.created'))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(handlePaymentEventUseCase.execute).not.toHaveBeenCalled();
  });

  it('delegates to HandlePaymentEventUseCase for payment.completed', async () => {
    signatureVerifier.verify.mockResolvedValue(true);
    const request = buildRequest('good-sig', '{}');
    const dto = buildDto('payment.completed', 'order-42');

    await controller.handle(request, dto);

    expect(handlePaymentEventUseCase.execute).toHaveBeenCalledWith(
      'payment.completed',
      'order-42',
      'order-42',
    );
  });

  it('delegates to HandlePaymentEventUseCase for payment.failed', async () => {
    signatureVerifier.verify.mockResolvedValue(true);
    const request = buildRequest('good-sig', '{}');
    const dto = buildDto('payment.failed', 'order-43');

    await controller.handle(request, dto);

    expect(handlePaymentEventUseCase.execute).toHaveBeenCalledWith(
      'payment.failed',
      'order-43',
      'order-43',
    );
  });
});
