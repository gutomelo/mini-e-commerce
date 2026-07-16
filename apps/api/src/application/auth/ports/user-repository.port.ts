import { NewUser, User } from '../../../domain/auth/user.entity';

/**
 * Abstracts user persistence. Use cases depend only on this interface;
 * `PrismaUserRepository` (infrastructure layer) is the concrete adapter.
 */
export abstract class UserRepository {
  abstract findByEmail(email: string): Promise<User | null>;
  abstract findById(id: string): Promise<User | null>;
  abstract create(user: NewUser): Promise<User>;
}
