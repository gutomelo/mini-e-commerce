import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { TokenServicePort } from '../../../application/auth/ports/token-service.port';
import { UnauthorizedError } from '../../../domain/errors';
import { RequestWithUser } from '../request-with-user';

/**
 * Validates the `Authorization: Bearer <token>` header against the access
 * JWT secret and attaches the decoded claims to `req.user`. Throws
 * `UnauthorizedError` (mapped to 401 by the global exception filter) when
 * the header is missing or the token is invalid/expired.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokenService: TokenServicePort) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedError('Missing or malformed Authorization header');
    }

    try {
      request.user = this.tokenService.verifyAccessToken(token);
    } catch {
      throw new UnauthorizedError('Invalid or expired access token');
    }

    return true;
  }
}

function extractBearerToken(header: string | undefined): string | undefined {
  if (!header) {
    return undefined;
  }
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : undefined;
}
