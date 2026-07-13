import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  AccessTokenPayload,
  GeneratedRefreshToken,
  RefreshTokenPayload,
  TokenServicePort,
} from '../../application/auth/ports/token-service.port';
import { parseDurationToMs, resolveJwtConfig } from './jwt-config';

/**
 * `@nestjs/jwt` adapter. Access and refresh tokens are signed with distinct
 * secrets so a leaked access-token secret can't be used to mint refresh
 * tokens (and vice versa).
 */
@Injectable()
export class JwtTokenService implements TokenServicePort {
  private readonly config = resolveJwtConfig();

  constructor(private readonly jwtService: JwtService) {}

  generateAccessToken(payload: AccessTokenPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.config.accessSecret,
      // `expiresIn` accepts a `number` of seconds or a narrow template-literal
      // string type; TTLs come from process.env as a plain `string`, so they
      // are converted to seconds up front rather than fighting that type.
      expiresIn: parseDurationToMs(this.config.accessTtl) / 1000,
    });
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return this.verify<AccessTokenPayload>(token, this.config.accessSecret);
  }

  generateRefreshToken(userId: string): GeneratedRefreshToken {
    const payload: RefreshTokenPayload = { sub: userId, jti: randomUUID() };
    const expiresInMs = parseDurationToMs(this.config.refreshTtl);
    const token = this.jwtService.sign(payload, {
      secret: this.config.refreshSecret,
      expiresIn: expiresInMs / 1000,
    });
    const expiresAt = new Date(Date.now() + expiresInMs);
    return { token, expiresAt };
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    return this.verify<RefreshTokenPayload>(token, this.config.refreshSecret);
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Throws a plain `Error` (not a Nest `HttpException`) on invalid/expired
   * tokens, keeping this adapter's failure signal framework-agnostic.
   * Callers (guards, use cases) translate it into the appropriate domain
   * error or HTTP response.
   */
  private verify<T extends object>(token: string, secret: string): T {
    try {
      return this.jwtService.verify<T>(token, { secret });
    } catch {
      throw new Error('Invalid or expired token');
    }
  }
}
