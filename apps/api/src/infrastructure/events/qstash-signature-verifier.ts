import { Injectable, Logger } from '@nestjs/common';
import { Receiver } from '@upstash/qstash';
import { resolveCurrentSigningKey, resolveNextSigningKey } from './qstash-env';

/**
 * Wraps `@upstash/qstash`'s `Receiver` to verify the `Upstash-Signature`
 * header on inbound webhook requests against the exact raw request body.
 *
 * Accepts both the current and next signing keys (a rotation-in-progress
 * delivery signed with the previous key must still verify), matching
 * `apps/inventory`/`apps/payment`'s own consumers.
 *
 * `Receiver.verify` throws a `SignatureError` for an invalid signature
 * rather than resolving `false` — this wrapper catches that (and any other
 * unexpected error) and always resolves a boolean, so callers never need to
 * handle a rejected promise for what is, from their perspective, simply an
 * unauthenticated request.
 */
@Injectable()
export class QStashSignatureVerifier {
  private readonly logger = new Logger(QStashSignatureVerifier.name);
  private readonly receiver: Receiver;

  constructor() {
    this.receiver = new Receiver({
      currentSigningKey: resolveCurrentSigningKey() ?? '',
      nextSigningKey: resolveNextSigningKey() ?? '',
    });
  }

  async verify(signature: string, rawBody: string): Promise<boolean> {
    try {
      return await this.receiver.verify({ signature, body: rawBody });
    } catch (error) {
      this.logger.warn(
        `Rejected QStash webhook with an invalid signature: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }
}
