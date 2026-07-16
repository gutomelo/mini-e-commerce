import { DomainError } from './domain-error';

/**
 * Raised when an authenticated caller is not allowed to perform an action
 * (e.g. a CUSTOMER attempting an ADMIN-only catalog write). Maps to HTTP 403.
 */
export class ForbiddenError extends DomainError {
  readonly httpStatus = 403;
  readonly code = 'FORBIDDEN';

  constructor(message = 'You do not have permission to perform this action') {
    super(message);
  }
}
