import { Injectable } from '@nestjs/common';
import { UnauthorizedError } from '../../../domain/errors';
import { RefreshTokenRepository } from '../ports/refresh-token-repository.port';
import { TokenServicePort } from '../ports/token-service.port';
import { UserRepository } from '../ports/user-repository.port';
import { TokenPair } from './login.use-case';

export interface RefreshTokensInput {
  refreshToken: string;
}

/**
 * Rotates a refresh token: the presented token must be a currently-valid,
 * unexpired, unrevoked refresh token; it is atomically revoked and replaced
 * by a brand new access/refresh pair. This is the key security property —
 * a reused (already-rotated or revoked) refresh token must always be
 * rejected with `UnauthorizedError`, which prevents replay of a stolen
 * token past its first use.
 */
@Injectable()
export class RefreshTokensUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly tokenService: TokenServicePort,
  ) {}

  async execute(input: RefreshTokensInput): Promise<TokenPair> {
    let payload: { sub: string };
    try {
      payload = this.tokenService.verifyRefreshToken(input.refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const tokenHash = this.tokenService.hashRefreshToken(input.refreshToken);
    const stored = await this.refreshTokenRepository.findByTokenHash(tokenHash);
    if (!stored) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
    if (stored.revokedAt) {
      throw new UnauthorizedError('Refresh token has already been used or revoked');
    }
    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedError('Refresh token has expired');
    }

    const user = await this.userRepository.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // Rotation: atomically revoke the presented token before issuing a new
    // one. `revoke` only reports success if this call is the one that
    // actually flipped `revokedAt` — the earlier `stored.revokedAt` check
    // above is best-effort only and can't prevent two concurrent requests
    // both reading the row before either writes to it. This atomic
    // check-and-set is what actually stops a stolen token from being
    // replayed twice under a race.
    const revoked = await this.refreshTokenRepository.revoke(stored.id);
    if (!revoked) {
      throw new UnauthorizedError('Refresh token has already been used or revoked');
    }

    const accessToken = this.tokenService.generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    const newRefreshToken = this.tokenService.generateRefreshToken(user.id);

    await this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash: this.tokenService.hashRefreshToken(newRefreshToken.token),
      expiresAt: newRefreshToken.expiresAt,
    });

    return { accessToken, refreshToken: newRefreshToken.token };
  }
}
