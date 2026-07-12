# syntax=docker/dockerfile:1
# Build context: repository root (see docker-compose.yml)

FROM node:24-alpine AS base
RUN corepack enable pnpm

# Prune the monorepo to only what the admin app needs
FROM base AS pruner
WORKDIR /repo
COPY . .
RUN pnpm dlx turbo@^2 prune admin --docker

# Install dependencies and build the static bundle
FROM base AS builder
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo run build --filter=admin

# Static runtime: nginx serving the SPA under /admin/
FROM nginx:1.29-alpine AS runner
COPY apps/admin/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /repo/apps/admin/dist/admin/browser /usr/share/nginx/html/admin
EXPOSE 80
