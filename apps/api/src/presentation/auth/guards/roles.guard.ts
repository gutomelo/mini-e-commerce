import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenError } from '../../../domain/errors';
import { UserRole } from '../../../domain/auth/user-role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestWithUser } from '../request-with-user';

/**
 * Enforces the roles set by `@Roles(...)`. Must run after `JwtAuthGuard`
 * (relies on `req.user` already being populated). Routes with no `@Roles`
 * metadata are allowed through unrestricted.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!requiredRoles.includes(request.user.role)) {
      throw new ForbiddenError();
    }

    return true;
  }
}
