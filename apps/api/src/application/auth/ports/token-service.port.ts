import { UserRole } from '../../../domain/auth/user-role.enum';

/** Claims carried by the access token, per the API core spec. */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

/** Claims carried by the refresh token. */
export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

export interface GeneratedRefreshToken {
  token: string;
  expiresAt: Date;
}

/**
 * Abstracts JWT issuance/verification and refresh-token hashing so use
 * cases never import `@nestjs/jwt` or `crypto` directly.
 * `JwtTokenService` (infrastructure layer) is the concrete adapter.
 */
export abstract class TokenServicePort {
  abstract generateAccessToken(payload: AccessTokenPayload): string;

  /** Verifies signature and expiry; throws if the access token is invalid or expired. */
  abstract verifyAccessToken(token: string): AccessTokenPayload;

  abstract generateRefreshToken(userId: string): GeneratedRefreshToken;

  /** Verifies signature and expiry; throws if the refresh token is invalid or expired. */
  abstract verifyRefreshToken(token: string): RefreshTokenPayload;

  /**
   * One-way hash of a refresh token's plaintext, used for storage/lookup.
   * Refresh tokens are already high-entropy random JWTs, so a fast
   * cryptographic hash (SHA-256) is sufficient — unlike passwords, they
   * don't need a slow, salted KDF.
   */
  abstract hashRefreshToken(token: string): string;
}
