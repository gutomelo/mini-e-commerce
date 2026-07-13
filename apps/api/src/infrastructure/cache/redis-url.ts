/**
 * Development fallback matching the docker-compose defaults (redis
 * published on the host at port 6380). Real deployments always provide
 * REDIS_URL — in production it points at Upstash (`rediss://`).
 */
export const DEFAULT_REDIS_URL = 'redis://localhost:6380';

export function resolveRedisUrl(): string {
  return process.env.REDIS_URL ?? DEFAULT_REDIS_URL;
}
