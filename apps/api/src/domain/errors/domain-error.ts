/**
 * Base class for all domain-level errors.
 *
 * Domain errors carry no HTTP concerns; the presentation layer (global
 * exception filter) is responsible for mapping `httpStatus` to an actual
 * HTTP response. Keeping the mapping in one place lets use cases stay
 * framework-agnostic while still producing predictable API responses.
 */
export abstract class DomainError extends Error {
  /** HTTP status code the exception filter should map this error to. */
  abstract readonly httpStatus: number;

  /** Short machine-readable error code, mirrors the HTTP reason phrase by default. */
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
