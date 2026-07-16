import { UnauthorizedError } from '../../../domain/errors';
import { User } from '../../../domain/auth/user.entity';
import { UserRole } from '../../../domain/auth/user-role.enum';
import { PasswordHasherPort } from '../ports/password-hasher.port';
import { RefreshTokenRepository } from '../ports/refresh-token-repository.port';
import { TokenServicePort } from '../ports/token-service.port';
import { UserRepository } from '../ports/user-repository.port';
import { MockedPort } from '../../../test/mocked-port';
import { LoginUseCase } from './login.use-case';

describe('LoginUseCase', () => {
  const user: User = {
    id: 'user-1',
    email: 'jane@example.com',
    passwordHash: 'hashed-password',
    name: 'Jane Doe',
    role: UserRole.CUSTOMER,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let userRepository: MockedPort<UserRepository>;
  let passwordHasher: MockedPort<PasswordHasherPort>;
  let refreshTokenRepository: MockedPort<RefreshTokenRepository>;
  let tokenService: MockedPort<TokenServicePort>;
  let useCase: LoginUseCase;

  beforeEach(() => {
    userRepository = { findByEmail: jest.fn(), findById: jest.fn(), create: jest.fn() };
    passwordHasher = { hash: jest.fn(), compare: jest.fn() };
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
    useCase = new LoginUseCase(
      userRepository,
      passwordHasher,
      refreshTokenRepository,
      tokenService,
    );
  });

  it('returns a new access/refresh token pair and persists the hashed refresh token', async () => {
    userRepository.findByEmail.mockResolvedValue(user);
    passwordHasher.compare.mockResolvedValue(true);
    tokenService.generateAccessToken.mockReturnValue('access-token');
    const expiresAt = new Date('2026-08-01T00:00:00.000Z');
    tokenService.generateRefreshToken.mockReturnValue({ token: 'refresh-token', expiresAt });
    tokenService.hashRefreshToken.mockReturnValue('hashed-refresh-token');

    const result = await useCase.execute({ email: user.email, password: 'correct-password' });

    expect(passwordHasher.compare).toHaveBeenCalledWith('correct-password', user.passwordHash);
    expect(tokenService.generateAccessToken).toHaveBeenCalledWith({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    expect(refreshTokenRepository.create).toHaveBeenCalledWith({
      userId: user.id,
      tokenHash: 'hashed-refresh-token',
      expiresAt,
    });
    expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
  });

  it('throws UnauthorizedError when the password does not match', async () => {
    userRepository.findByEmail.mockResolvedValue(user);
    passwordHasher.compare.mockResolvedValue(false);

    await expect(useCase.execute({ email: user.email, password: 'wrong' })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );

    expect(refreshTokenRepository.create).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedError when the email is unknown', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    await expect(
      useCase.execute({ email: 'unknown@example.com', password: 'whatever' }),
    ).rejects.toBeInstanceOf(UnauthorizedError);

    expect(passwordHasher.compare).not.toHaveBeenCalled();
  });
});
