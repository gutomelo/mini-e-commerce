import { DomainError } from './domain-error';

/**
 * Raised when authentication fails or credentials/tokens are invalid.
 * Maps to HTTP 401. Use `ForbiddenError` (not yet needed) for authorization
 * (role) failures once the RBAC guards are introduced.
 */
export class UnauthorizedError extends DomainError {
  readonly httpStatus = 401;
  readonly code = 'UNAUTHORIZED';

  constructor(message = 'Invalid credentials') {
    super(message);
  }
}
