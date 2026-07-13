import { Injectable } from '@nestjs/common';
import { UnauthorizedError } from '../../../domain/errors';
import { PasswordHasherPort } from '../ports/password-hasher.port';
import { RefreshTokenRepository } from '../ports/refresh-token-repository.port';
import { TokenServicePort } from '../ports/token-service.port';
import { UserRepository } from '../ports/user-repository.port';

export interface LoginInput {
  email: string;
  password: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Authenticates a user by email/password and issues a fresh access/refresh
 * token pair. The refresh token is persisted hashed, never in plaintext.
 */
@Injectable()
export class LoginUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasherPort,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly tokenService: TokenServicePort,
  ) {}

  async execute(input: LoginInput): Promise<TokenPair> {
    const user = await this.userRepository.findByEmail(input.email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const passwordMatches = await this.passwordHasher.compare(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const accessToken = this.tokenService.generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = this.tokenService.generateRefreshToken(user.id);

    await this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash: this.tokenService.hashRefreshToken(refreshToken.token),
      expiresAt: refreshToken.expiresAt,
    });

    return { accessToken, refreshToken: refreshToken.token };
  }
}
