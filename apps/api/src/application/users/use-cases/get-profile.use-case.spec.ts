import { EntityNotFoundError } from '../../../domain/errors';
import { User } from '../../../domain/auth/user.entity';
import { UserRole } from '../../../domain/auth/user-role.enum';
import { UserRepository } from '../../auth/ports/user-repository.port';
import { MockedPort } from '../../../test/mocked-port';
import { GetProfileUseCase } from './get-profile.use-case';

describe('GetProfileUseCase', () => {
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
  let useCase: GetProfileUseCase;

  beforeEach(() => {
    userRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };
    useCase = new GetProfileUseCase(userRepository);
  });

  it('returns the profile without the password hash when the user exists', async () => {
    userRepository.findById.mockResolvedValue(existingUser);

    const result = await useCase.execute(existingUser.id);

    expect(userRepository.findById).toHaveBeenCalledWith(existingUser.id);
    expect(result).toEqual({
      id: existingUser.id,
      email: existingUser.email,
      name: existingUser.name,
      role: existingUser.role,
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('throws EntityNotFoundError when the user id does not resolve to an account', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing-id')).rejects.toBeInstanceOf(EntityNotFoundError);
  });
});
