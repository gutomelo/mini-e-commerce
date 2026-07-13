import { Request } from 'express';
import { AccessTokenPayload } from '../../application/auth/ports/token-service.port';

/** Express request shape after `JwtAuthGuard` has attached the decoded access-token claims. */
export interface RequestWithUser extends Request {
  user: AccessTokenPayload;
}
