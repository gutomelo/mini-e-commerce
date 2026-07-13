import { RefreshToken } from '../../../domain/auth/refresh-token.entity';
import { RefreshTokenRepository } from '../ports/refresh-token-repository.port';
import { TokenServicePort } from '../ports/token-service.port';
import { MockedPort } from '../../../test/mocked-port';
import { LogoutUseCase } from './logout.use-case';

describe('LogoutUseCase', () => {
  const storedToken: RefreshToken = {
    id: 'token-1',
    userId: 'user-1',
    tokenHash: 'hashed-token',
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    createdAt: new Date(),
  };

  let refreshTokenRepository: MockedPort<RefreshTokenRepository>;
  let tokenService: MockedPort<TokenServicePort>;
  let useCase: LogoutUseCase;

  beforeEach(() => {
    refreshTokenRepository = {
      create: jest.fn(),
      findByTokenHash: jest.fn(),
      revoke: jest.fn(),
      revokeAllForUser: jest.fn(),
    };
    tokenService = {
      generateAccessToken: jest.fn(),
      verifyAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
      hashRefreshToken: jest.fn(),
    };
    useCase = new LogoutUseCase(refreshTokenRepository, tokenService);
  });

  it('revokes the refresh token matching the presented hash', async () => {
    tokenService.hashRefreshToken.mockReturnValue('hashed-token');
    refreshTokenRepository.findByTokenHash.mockResolvedValue(storedToken);

    await useCase.execute({ refreshToken: 'plain-token' });

    expect(refreshTokenRepository.revoke).toHaveBeenCalledWith(storedToken.id);
  });

  it('is idempotent when the token is already revoked', async () => {
    tokenService.hashRefreshToken.mockReturnValue('hashed-token');
    refreshTokenRepository.findByTokenHash.mockResolvedValue({
      ...storedToken,
      revokedAt: new Date(),
    });

    await useCase.execute({ refreshToken: 'plain-token' });

    expect(refreshTokenRepository.revoke).not.toHaveBeenCalled();
  });

  it('is idempotent when the token is unknown', async () => {
    tokenService.hashRefreshToken.mockReturnValue('unknown-hash');
    refreshTokenRepository.findByTokenHash.mockResolvedValue(null);

    await useCase.execute({ refreshToken: 'unknown-token' });

    expect(refreshTokenRepository.revoke).not.toHaveBeenCalled();
  });
});
