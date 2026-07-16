import { ConflictError } from '../../../domain/errors';
import { User } from '../../../domain/auth/user.entity';
import { UserRole } from '../../../domain/auth/user-role.enum';
import { PasswordHasherPort } from '../ports/password-hasher.port';
import { UserRepository } from '../ports/user-repository.port';
import { MockedPort } from '../../../test/mocked-port';
import { RegisterUserUseCase } from './register-user.use-case';

describe('RegisterUserUseCase', () => {
  const existingUser: User = {
    id: 'user-1',
    email: 'existing@example.com',
    passwordHash: 'hashed',
    name: 'Existing User',
    role: UserRole.CUSTOMER,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let userRepository: MockedPort<UserRepository>;
  let passwordHasher: MockedPort<PasswordHasherPort>;
  let useCase: RegisterUserUseCase;

  beforeEach(() => {
    userRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };
    passwordHasher = {
      hash: jest.fn(),
      compare: jest.fn(),
    };
    useCase = new RegisterUserUseCase(userRepository, passwordHasher);
  });

  it('creates a CUSTOMER account with a hashed password when the email is free', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    passwordHasher.hash.mockResolvedValue('hashed-password');
    userRepository.create.mockResolvedValue({
      id: 'user-2',
      email: 'new@example.com',
      passwordHash: 'hashed-password',
      name: 'New User',
      role: UserRole.CUSTOMER,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await useCase.execute({
      email: 'new@example.com',
      password: 'plain-password',
      name: 'New User',
    });

    expect(passwordHasher.hash).toHaveBeenCalledWith('plain-password');
    expect(userRepository.create).toHaveBeenCalledWith({
      email: 'new@example.com',
      passwordHash: 'hashed-password',
      name: 'New User',
      role: UserRole.CUSTOMER,
    });
    expect(result).toEqual({
      id: 'user-2',
      email: 'new@example.com',
      name: 'New User',
      role: UserRole.CUSTOMER,
    });
  });

  it('throws ConflictError when the email is already registered', async () => {
    userRepository.findByEmail.mockResolvedValue(existingUser);

    await expect(
      useCase.execute({
        email: existingUser.email,
        password: 'plain-password',
        name: 'Someone',
      }),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(userRepository.create).not.toHaveBeenCalled();
    expect(passwordHasher.hash).not.toHaveBeenCalled();
  });
});
