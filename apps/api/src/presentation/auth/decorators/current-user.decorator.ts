import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AccessTokenPayload } from '../../../application/auth/ports/token-service.port';
import { RequestWithUser } from '../request-with-user';

/** Injects the decoded access-token claims attached by `JwtAuthGuard`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessTokenPayload => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);
