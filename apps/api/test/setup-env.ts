import { applyTestEnv } from './support/test-env';

// Jest `setupFiles` entry: runs in every test worker before the test
// framework and any test file/module is evaluated, so `resolveDatabaseUrl()`,
// `resolveRedisUrl()`, and `resolveJwtConfig()` all pick up the test values
// the moment `PrismaService`/`RedisCacheAdapter`/`JwtTokenService` construct.
applyTestEnv();
