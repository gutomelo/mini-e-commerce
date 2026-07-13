import { Injectable } from '@nestjs/common';
import { RefreshTokenRepository } from '../ports/refresh-token-repository.port';
import { TokenServicePort } from '../ports/token-service.port';

export interface LogoutInput {
  refreshToken: string;
}

/**
 * Revokes the presented refresh token. Idempotent: if the token is already
 * revoked, unknown, or malformed, logout still succeeds silently — the
 * caller's goal ("make sure this token can't be used again") is already
 * satisfied and leaking whether a token existed is not useful information.
 */
@Injectable()
export class LogoutUseCase {
  constructor(
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly tokenService: TokenServicePort,
  ) {}

  async execute(input: LogoutInput): Promise<void> {
    const tokenHash = this.tokenService.hashRefreshToken(input.refreshToken);
    const stored = await this.refreshTokenRepository.findByTokenHash(tokenHash);
    if (stored && !stored.revokedAt) {
      await this.refreshTokenRepository.revoke(stored.id);
    }
  }
}
