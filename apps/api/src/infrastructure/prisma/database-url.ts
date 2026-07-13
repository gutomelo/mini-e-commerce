/**
 * Development fallback matching the docker-compose defaults (postgres
 * published on the host at port 5433). Real deployments always provide
 * DATABASE_URL; typed environment validation lands with the API foundations
 * task and will replace direct process.env access.
 */
export const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/mini_ecommerce';

export function resolveDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}
