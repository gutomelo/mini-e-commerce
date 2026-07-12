# syntax=docker/dockerfile:1
# Build context: repository root (see docker-compose.yml)

FROM node:24-alpine AS base
RUN corepack enable pnpm

# Prune the monorepo to only what the web app needs
FROM base AS pruner
WORKDIR /repo
COPY . .
RUN pnpm dlx turbo@^2 prune web --docker

# Install dependencies and build
FROM base AS builder
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo run build --filter=web

# Minimal runtime with the Next.js standalone output
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
