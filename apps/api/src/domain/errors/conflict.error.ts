import { DomainError } from './domain-error';

/**
 * Raised when an operation conflicts with existing state, e.g. a unique
 * constraint violation (duplicate email, slug already in use). Maps to
 * HTTP 409.
 */
export class ConflictError extends DomainError {
  readonly httpStatus = 409;
  readonly code = 'CONFLICT';

  constructor(message: string) {
    super(message);
  }
}
