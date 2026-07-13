import { Injectable } from '@nestjs/common';
import { ConflictError } from '../../../domain/errors';
import { UserRole } from '../../../domain/auth/user-role.enum';
import { PasswordHasherPort } from '../ports/password-hasher.port';
import { UserRepository } from '../ports/user-repository.port';

export interface RegisterUserInput {
  email: string;
  password: string;
  name: string;
}

export interface RegisterUserOutput {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

/**
 * Registers a new customer account. Always assigns the `CUSTOMER` role —
 * admin accounts are provisioned only via the seed script, never through
 * this public endpoint.
 */
@Injectable()
export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(input: RegisterUserInput): Promise<RegisterUserOutput> {
    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) {
      throw new ConflictError(`Email "${input.email}" is already registered`);
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = await this.userRepository.create({
      email: input.email,
      passwordHash,
      name: input.name,
      role: UserRole.CUSTOMER,
    });

    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }
}
