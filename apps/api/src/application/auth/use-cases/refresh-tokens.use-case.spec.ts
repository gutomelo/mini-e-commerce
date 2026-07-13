import { UnauthorizedError } from '../../../domain/errors';
import { RefreshToken } from '../../../domain/auth/refresh-token.entity';
import { User } from '../../../domain/auth/user.entity';
import { UserRole } from '../../../domain/auth/user-role.enum';
import { RefreshTokenRepository } from '../ports/refresh-token-repository.port';
import { TokenServicePort } from '../ports/token-service.port';
import { UserRepository } from '../ports/user-repository.port';
import { MockedPort } from '../../../test/mocked-port';
import { RefreshTokensUseCase } from './refresh-tokens.use-case';

describe('RefreshTokensUseCase', () => {
  const user: User = {
    id: 'user-1',
    email: 'jane@example.com',
    passwordHash: 'hashed-password',
    name: 'Jane Doe',
    role: UserRole.CUSTOMER,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const activeStoredToken: RefreshToken = {
    id: 'token-1',
    userId: user.id,
    tokenHash: 'hashed-old-token',
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    createdAt: new Date(),
  };

  let userRepository: MockedPort<UserRepository>;
  let refreshTokenRepository: MockedPort<RefreshTokenRepository>;
  let tokenService: MockedPort<TokenServicePort>;
  let useCase: RefreshTokensUseCase;

  beforeEach(() => {
    userRepository = { findByEmail: jest.fn(), findById: jest.fn(), create: jest.fn() };
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
    useCase = new RefreshTokensUseCase(userRepository, refreshTokenRepository, tokenService);
  });

  it('rotates: revokes the old token and persists a brand new hashed token', async () => {
    tokenService.verifyRefreshToken.mockReturnValue({ sub: user.id, jti: 'jti-1' });
    tokenService.hashRefreshToken.mockReturnValueOnce('hashed-old-token');
    refreshTokenRepository.findByTokenHash.mockResolvedValue(activeStoredToken);
    refreshTokenRepository.revoke.mockResolvedValue(true);
    userRepository.findById.mockResolvedValue(user);
    tokenService.generateAccessToken.mockReturnValue('new-access-token');
    const newExpiresAt = new Date(Date.now() + 7 * 86_400_000);
    tokenService.generateRefreshToken.mockReturnValue({
      token: 'new-refresh-token',
      expiresAt: newExpiresAt,
    });
    tokenService.hashRefreshToken.mockReturnValueOnce('hashed-new-token');

    const result = await useCase.execute({ refreshToken: 'old-refresh-token' });

    expect(refreshTokenRepository.revoke).toHaveBeenCalledWith(activeStoredToken.id);
    expect(refreshTokenRepository.create).toHaveBeenCalledWith({
      userId: user.id,
      tokenHash: 'hashed-new-token',
      expiresAt: newExpiresAt,
    });
    expect(result).toEqual({ accessToken: 'new-access-token', refreshToken: 'new-refresh-token' });
  });

  it('rejects a reused (already revoked) refresh token', async () => {
    tokenService.verifyRefreshToken.mockReturnValue({ sub: user.id, jti: 'jti-1' });
    tokenService.hashRefreshToken.mockReturnValue('hashed-old-token');
    refreshTokenRepository.findByTokenHash.mockResolvedValue({
      ...activeStoredToken,
      revokedAt: new Date(),
    });

    await expect(useCase.execute({ refreshToken: 'old-refresh-token' })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );

    expect(refreshTokenRepository.revoke).not.toHaveBeenCalled();
    expect(refreshTokenRepository.create).not.toHaveBeenCalled();
  });

  it('rejects an expired refresh token', async () => {
    tokenService.verifyRefreshToken.mockReturnValue({ sub: user.id, jti: 'jti-1' });
    tokenService.hashRefreshToken.mockReturnValue('hashed-old-token');
    refreshTokenRepository.findByTokenHash.mockResolvedValue({
      ...activeStoredToken,
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(useCase.execute({ refreshToken: 'old-refresh-token' })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );

    expect(refreshTokenRepository.revoke).not.toHaveBeenCalled();
  });

  it('rejects when the token signature/expiry verification fails', async () => {
    tokenService.verifyRefreshToken.mockImplementation(() => {
      throw new Error('invalid signature');
    });

    await expect(useCase.execute({ refreshToken: 'tampered-token' })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );

    expect(refreshTokenRepository.findByTokenHash).not.toHaveBeenCalled();
  });

  it('rejects when the token hash is not found in storage', async () => {
    tokenService.verifyRefreshToken.mockReturnValue({ sub: user.id, jti: 'jti-1' });
    tokenService.hashRefreshToken.mockReturnValue('unknown-hash');
    refreshTokenRepository.findByTokenHash.mockResolvedValue(null);

    await expect(useCase.execute({ refreshToken: 'unknown-token' })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('rejects when a concurrent request already revoked the token (atomic revoke lost the race)', async () => {
    tokenService.verifyRefreshToken.mockReturnValue({ sub: user.id, jti: 'jti-1' });
    tokenService.hashRefreshToken.mockReturnValue('hashed-old-token');
    refreshTokenRepository.findByTokenHash.mockResolvedValue(activeStoredToken);
    userRepository.findById.mockResolvedValue(user);
    // Simulates another concurrent request winning the atomic
    // `UPDATE ... WHERE revokedAt IS NULL` race first.
    refreshTokenRepository.revoke.mockResolvedValue(false);

    await expect(useCase.execute({ refreshToken: 'old-refresh-token' })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );

    expect(refreshTokenRepository.create).not.toHaveBeenCalled();
  });
});
