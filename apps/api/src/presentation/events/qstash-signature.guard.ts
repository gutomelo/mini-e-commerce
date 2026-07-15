import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { QStashSignatureVerifier } from '../../infrastructure/events/qstash-signature-verifier';

/**
 * Verifies the `Upstash-Signature` header before the request reaches any
 * `@Body()`-bound DTO.
 *
 * Nest resolves guards before pipes in its request lifecycle (middleware ->
 * guards -> interceptors (pre) -> pipes -> route handler), so running this
 * check here — rather than inside the controller method, after `@Body()`
 * has already triggered the global `ValidationPipe` — is what actually
 * guarantees an unauthenticated request never reaches DTO validation, let
 * alone `HandlePaymentEventUseCase`. Placing the check inside the handler
 * body instead would let a request with an invalid body shape (and no
 * valid signature at all) receive a `400` with `class-validator`'s error
 * details before signature verification ever ran.
 */
@Injectable()
export class QStashSignatureGuard implements CanActivate {
  constructor(private readonly signatureVerifier: QStashSignatureVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const signature = request.headers['upstash-signature'];
    const rawBody = request.rawBody?.toString('utf-8');

    if (typeof signature !== 'string' || !rawBody) {
      throw new UnauthorizedException('Missing Upstash-Signature or request body');
    }

    const verified = await this.signatureVerifier.verify(signature, rawBody);
    if (!verified) {
      throw new UnauthorizedException('Invalid Upstash-Signature');
    }

    return true;
  }
}
