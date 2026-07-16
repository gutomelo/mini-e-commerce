import { defineConfig } from 'prisma/config';
import { resolveDatabaseUrl } from './src/infrastructure/prisma/database-url';

// Note: `env()` from prisma/config throws at config-load time when the
// variable is missing, which would break `prisma generate` in CI/Docker
// builds (generate never connects to the database). The resolver falls back
// to the docker-compose defaults so local CLI usage works out of the box.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: resolveDatabaseUrl(),
  },
});
