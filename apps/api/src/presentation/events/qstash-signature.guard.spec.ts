import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { QStashSignatureVerifier } from '../../infrastructure/events/qstash-signature-verifier';
import { QStashSignatureGuard } from './qstash-signature.guard';

function buildContext(
  signature: string | undefined,
  rawBody: string | undefined,
): ExecutionContext {
  const request = {
    headers: signature === undefined ? {} : { 'upstash-signature': signature },
    rawBody: rawBody === undefined ? undefined : Buffer.from(rawBody, 'utf-8'),
  } as unknown as RawBodyRequest<Request>;

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('QStashSignatureGuard', () => {
  let signatureVerifier: { verify: jest.Mock };
  let guard: QStashSignatureGuard;

  beforeEach(() => {
    signatureVerifier = { verify: jest.fn() };
    guard = new QStashSignatureGuard(signatureVerifier as unknown as QStashSignatureVerifier);
  });

  it('rejects with 401 when the Upstash-Signature header is missing', async () => {
    const context = buildContext(undefined, '{}');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(signatureVerifier.verify).not.toHaveBeenCalled();
  });

  it('rejects with 401 when the raw body is unavailable', async () => {
    const context = buildContext('sig-1', undefined);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(signatureVerifier.verify).not.toHaveBeenCalled();
  });

  it('rejects with 401 when the signature does not verify', async () => {
    signatureVerifier.verify.mockResolvedValue(false);
    const context = buildContext('bad-sig', '{}');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows the request through when the signature verifies', async () => {
    signatureVerifier.verify.mockResolvedValue(true);
    const context = buildContext('good-sig', '{}');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(signatureVerifier.verify).toHaveBeenCalledWith('good-sig', '{}');
  });
});
