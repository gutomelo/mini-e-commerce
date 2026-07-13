import { DomainError } from './domain-error';

/**
 * Raised when a use case rejects input on business-rule grounds (as opposed
 * to the DTO shape validation already handled by the global `ValidationPipe`).
 * Maps to HTTP 400.
 */
export class ValidationError extends DomainError {
  readonly httpStatus = 400;
  readonly code = 'VALIDATION_ERROR';

  constructor(message: string) {
    super(message);
  }
}
