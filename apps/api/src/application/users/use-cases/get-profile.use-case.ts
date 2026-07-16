import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../auth/ports/user-repository.port';
import { UserRole } from '../../../domain/auth/user-role.enum';
import { EntityNotFoundError } from '../../../domain/errors';

export interface ProfileOutput {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

/**
 * Returns the authenticated user's profile. The id comes from a validated
 * access-token payload (`JwtAuthGuard`), so a lookup miss only happens in the
 * edge case where the account was deleted after the token was issued.
 */
@Injectable()
export class GetProfileUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(userId: string): Promise<ProfileOutput> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new EntityNotFoundError('User', userId);
    }

    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }
}
