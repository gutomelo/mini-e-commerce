import { NewRefreshToken, RefreshToken } from '../../../domain/auth/refresh-token.entity';

/**
 * Abstracts refresh-token persistence. Use cases depend only on this
 * interface; `PrismaRefreshTokenRepository` (infrastructure layer) is the
 * concrete adapter.
 */
export abstract class RefreshTokenRepository {
  abstract create(token: NewRefreshToken): Promise<RefreshToken>;

  /** Looks up a refresh token by its hash (never by plaintext). */
  abstract findByTokenHash(tokenHash: string): Promise<RefreshToken | null>;

  /**
   * Atomically marks a single refresh token as revoked, but only if it is
   * not already revoked. Returns `true` if this call performed the
   * revocation, `false` if the token was already revoked (e.g. a
   * concurrent request beat it to it). Callers must treat `false` as a
   * rejection, not a no-op success, to prevent a stolen token from being
   * replayed twice in a race.
   */
  abstract revoke(id: string): Promise<boolean>;

  /** Revokes every active refresh token for a user (not wired to a route yet, available for future account-security flows). */
  abstract revokeAllForUser(userId: string): Promise<void>;
}
