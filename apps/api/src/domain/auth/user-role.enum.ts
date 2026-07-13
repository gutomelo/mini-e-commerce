/**
 * Application-level user roles. Deliberately redeclared here (rather than
 * importing the generated Prisma enum) so domain/application code never
 * depends on generated Prisma types.
 */
export type UserRole = 'CUSTOMER' | 'ADMIN';

export const UserRole = {
  CUSTOMER: 'CUSTOMER',
  ADMIN: 'ADMIN',
} as const satisfies Record<string, UserRole>;
