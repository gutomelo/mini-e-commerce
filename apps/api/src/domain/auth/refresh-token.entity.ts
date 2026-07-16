/**
 * Domain representation of a persisted refresh token. `tokenHash` is a
 * one-way hash of the actual bearer token handed to the client — the
 * plaintext token itself is never persisted or logged.
 */
export interface RefreshToken {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
}

/** Fields required to persist a new refresh token. */
export type NewRefreshToken = Pick<RefreshToken, 'userId' | 'tokenHash' | 'expiresAt'>;
