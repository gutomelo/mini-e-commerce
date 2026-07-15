import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { TEST_API_QSTASH_DESTINATION_URL, TEST_QSTASH_CURRENT_SIGNING_KEY } from './test-env';

/**
 * Reproduces the exact JWT shape Upstash's real QStash signer produces for
 * the `Upstash-Signature` header, so the e2e suite can hand-sign webhook
 * payloads and have `QStashSignatureVerifier` (backed by `@upstash/qstash`'s
 * `Receiver.verify`) accept them without any live Upstash dependency.
 *
 * Mirrors the reference implementation already proven correct in
 * `apps/payment`'s own Java integration tests
 * (`PaymentIntegrationTests`'s private `sign`/`hash` methods): `HS256`,
 * `iss: "Upstash"`, `sub: <destinationUrl>`, `body: base64url(sha256(rawBody))`
 * (no padding), `iat: now`, `exp: now + 1 minute`.
 *
 * `rawBody` must be the exact bytes that will be sent as the request body —
 * the signature is computed over the raw string, and any re-serialization
 * (e.g. supertest re-stringifying a plain object passed to `.send()`) would
 * produce a different byte sequence and fail verification.
 */
export function signQStashRequest(
  rawBody: string,
  signingKey: string = TEST_QSTASH_CURRENT_SIGNING_KEY,
  destinationUrl: string = TEST_API_QSTASH_DESTINATION_URL,
): string {
  const bodyHash = createHash('sha256').update(rawBody, 'utf-8').digest('base64url');

  const nowSeconds = Math.floor(Date.now() / 1000);

  return jwt.sign(
    {
      iss: 'Upstash',
      sub: destinationUrl,
      body: bodyHash,
      iat: nowSeconds,
      exp: nowSeconds + 60,
    },
    signingKey,
    { algorithm: 'HS256' },
  );
}
