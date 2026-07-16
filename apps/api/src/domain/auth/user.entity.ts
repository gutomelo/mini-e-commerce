import { UserRole } from './user-role.enum';

/**
 * Domain representation of a user account. Intentionally decoupled from the
 * generated Prisma model so application/domain code has no framework or ORM
 * dependency — infrastructure repositories are responsible for mapping
 * between this shape and persistence.
 */
export interface User {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly name: string;
  readonly role: UserRole;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Fields required to create a new user; id/timestamps are assigned by persistence. */
export type NewUser = Pick<User, 'email' | 'passwordHash' | 'name' | 'role'>;
