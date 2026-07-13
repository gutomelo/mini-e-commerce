import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../../domain/auth/user-role.enum';

export const ROLES_KEY = 'roles';

/** Marks a route handler (or controller) as restricted to the given roles; enforced by `RolesGuard`. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
