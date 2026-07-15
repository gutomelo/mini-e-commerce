import { Injectable, Logger } from '@nestjs/common';
import { Receiver } from '@upstash/qstash';
import {
  resolveApiDestinationUrl,
  resolveCurrentSigningKey,
  resolveNextSigningKey,
} from './qstash-env';

/**
 * Wraps `@upstash/qstash`'s `Receiver` to verify the `Upstash-Signature`
 * header on inbound webhook requests against the exact raw request body
 * and, when configured, the destination URL the request claims to target.
 *
 * Accepts both the current and next signing keys (a rotation-in-progress
 * delivery signed with the previous key must still verify), and checks the
 * `url` claim against `API_QSTASH_DESTINATION_URL` — matching
 * `apps/inventory`/`apps/payment`'s own consumers, which verify the same
 * way. The URL check is skipped (signature-only) when that env var is
 * unset, so local dev without it configured doesn't reject every request.
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
  private readonly destinationUrl: string | undefined;

  constructor() {
    this.receiver = new Receiver({
      currentSigningKey: resolveCurrentSigningKey() ?? '',
      nextSigningKey: resolveNextSigningKey() ?? '',
    });
    this.destinationUrl = resolveApiDestinationUrl();
  }

  async verify(signature: string, rawBody: string): Promise<boolean> {
    try {
      return await this.receiver.verify({
        signature,
        body: rawBody,
        url: this.destinationUrl,
      });
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
