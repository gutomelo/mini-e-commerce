/**
 * Development-only fallbacks. Real deployments always provide these via
 * environment variables (see `.env.example`); the fallbacks exist so local
 * `pnpm dev` works without extra setup, matching the pattern used by
 * `resolveDatabaseUrl`/`resolveRedisUrl`.
 */
const DEFAULT_JWT_ACCESS_SECRET = 'dev-access-secret-change-me';
const DEFAULT_JWT_REFRESH_SECRET = 'dev-refresh-secret-change-me';
const DEFAULT_JWT_ACCESS_TTL = '15m';
const DEFAULT_JWT_REFRESH_TTL = '7d';

export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  accessTtl: string;
  refreshTtl: string;
}

export function resolveJwtConfig(): JwtConfig {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET)) {
    // Never silently sign tokens with the publicly-known dev defaults in
    // production — fail startup instead of issuing forgeable tokens.
    throw new Error(
      'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in production; refusing to fall back to development defaults.',
    );
  }

  return {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? DEFAULT_JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? DEFAULT_JWT_REFRESH_SECRET,
    accessTtl: process.env.JWT_ACCESS_TTL ?? DEFAULT_JWT_ACCESS_TTL,
    refreshTtl: process.env.JWT_REFRESH_TTL ?? DEFAULT_JWT_REFRESH_TTL,
  };
}

/** Converts a jwt-style duration string (`15m`, `7d`) to milliseconds for `Date` math. */
export function parseDurationToMs(duration: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(duration.trim());
  if (!match) {
    throw new Error(`Invalid JWT duration format: "${duration}"`);
  }
  const value = Number(match[1]);
  const unit = match[2];
  const unitMs: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return value * unitMs[unit];
}
