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

  /** Marks a single refresh token as revoked (used on rotation and logout). */
  abstract revoke(id: string): Promise<void>;

  /** Revokes every active refresh token for a user (not wired to a route yet, available for future account-security flows). */
  abstract revokeAllForUser(userId: string): Promise<void>;
}
