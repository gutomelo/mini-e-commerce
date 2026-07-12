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
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile --prod --ignore-scripts
COPY --from=builder --chown=node:node /repo/apps/api/dist ./apps/api/dist
USER node
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
