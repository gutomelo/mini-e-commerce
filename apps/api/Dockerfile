# syntax=docker/dockerfile:1
# Build context: repository root (see docker-compose.yml)

FROM node:24-alpine AS base
RUN corepack enable pnpm

# Prune the monorepo to only what the api app needs
FROM base AS pruner
WORKDIR /repo
COPY . .
RUN pnpm dlx turbo@2.10.4 prune api --docker

# Install all dependencies and build
FROM base AS builder
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo run build --filter=api

# Production runtime: prod-only dependencies plus the compiled output
FROM base AS runner
WORKDIR /repo
ENV NODE_ENV=production
ENV PORT=3001
# The Prisma schema engine (used by `prisma migrate deploy`) links against
# OpenSSL, which the alpine base image does not ship by default.
RUN apk add --no-cache openssl
COPY --from=pruner /repo/out/json/ .
# --ignore-scripts skips the root husky prepare hook; the packages that do
# need their install scripts (Prisma engine download, bcrypt prebuilt binary
# resolution) are rebuilt explicitly right after.
RUN pnpm install --frozen-lockfile --prod --ignore-scripts \
  && pnpm rebuild -r @prisma/engines bcrypt
# Prisma schema, migrations, and seed (run by the entrypoint on boot)
COPY --from=pruner /repo/out/full/apps/api/prisma ./apps/api/prisma
COPY --from=pruner /repo/out/full/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
# Generated Prisma client sources, imported by the tsx-executed seed script
COPY --from=builder /repo/apps/api/src/generated ./apps/api/src/generated
# The seed imports the database-url resolver from src
COPY --from=builder /repo/apps/api/src/infrastructure/prisma/database-url.ts ./apps/api/src/infrastructure/prisma/database-url.ts
COPY --from=builder --chown=node:node /repo/apps/api/dist ./apps/api/dist
# Workspace packages the api app imports at runtime (@mini-e-commerce/shared,
# @mini-e-commerce/types) are symlinked by the pnpm install above but only
# ship their source — `pnpm install --prod` never runs their build script.
# Copy the builder's compiled `dist/` output for each into place.
COPY --from=builder --chown=node:node /repo/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=node:node /repo/packages/types/dist ./packages/types/dist
COPY --chmod=755 apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh
USER node
EXPOSE 3001
ENTRYPOINT ["/repo/apps/api/docker-entrypoint.sh"]
