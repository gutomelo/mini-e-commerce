import { DomainError } from './domain-error';

/**
 * Raised when a use case looks up an entity by id/slug and it does not exist
 * (or is not visible to the caller). Maps to HTTP 404.
 */
export class EntityNotFoundError extends DomainError {
  readonly httpStatus = 404;
  readonly code = 'ENTITY_NOT_FOUND';

  constructor(entityName: string, identifier: string) {
    super(`${entityName} with identifier "${identifier}" was not found`);
  }
}
