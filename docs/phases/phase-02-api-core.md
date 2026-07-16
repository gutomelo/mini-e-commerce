# Phase 02 — API Core (NestJS)

- **Spec:** [api core](../specs/2026-07-12-api-core.md)
- **Roadmap:** [ROADMAP.md](../ROADMAP.md)

## Objective

Turn `apps/api` into the real API Gateway/BFF core: Clean Architecture layering, JWT auth with rotated refresh tokens and RBAC, the product/category catalog with pagination/filtering, Prisma migrations against PostgreSQL, Redis cache-aside with invalidation, and the cross-cutting API standards (versioning, validation, envelopes, Swagger, throttling, correlation IDs, structured logs, centralized errors) that every later phase consumes.

## Prerequisites

- [x] Phase 1 is `Done` in [ROADMAP.md](../ROADMAP.md)
- [x] Spec for this phase is `Approved`

## Tasks

- [x] Add `redis` service to docker-compose (`redis:alpine`, healthcheck, host port 6380 — 6379 is taken by the host's redis); give `api` the `DATABASE_URL`, `REDIS_URL`, and JWT env vars with compose defaults and `depends_on` healthy postgres + redis; update `.env.example` (owner: main)
- [x] Add shared API contract types to `packages/types`: `PaginationMeta`, `ListResponse<T>`, `SingleResponse<T>`, `ErrorResponse` (owner: main)
- [x] Prisma setup in `apps/api`: schema (`User`, `RefreshToken`, `Category`, `Product` per spec), initial committed migration, `PrismaService`, seed script (admin user + 3 categories / ~12 products), api Dockerfile runs `prisma migrate deploy` before starting (owner: nestjs-developer)
- [x] API foundations: URI versioning `/api/v1` (health stays `/api/health`), global `ValidationPipe` (whitelist + transform), success/error envelopes, global exception filter (no stack traces, domain-error mapping), correlation ID middleware (accept `x-correlation-id` or generate via `@mini-e-commerce/shared`), nestjs-pino structured JSON logging, Swagger at `/api/docs`, global throttling 100 req/min (owner: nestjs-developer)
- [x] Cache infrastructure: `CachePort` in application layer + ioredis adapter with TTL support, targeted invalidation helpers, and graceful degradation when Redis is down (owner: nestjs-developer)
- [x] Auth module (Clean Architecture): register/login/refresh/logout use cases, bcrypt hasher adapter, JWT token service, hashed refresh-token persistence with rotation and revocation, `JwtAuthGuard` + `RolesGuard`, stricter throttle (10 req/min) on auth routes, unit tests for the four use cases (owner: nestjs-developer)
- [x] Users module: `GET /api/v1/users/me` + unit test (owner: nestjs-developer)
- [x] Categories module: public cached list, ADMIN-only create/update/delete with cache invalidation, unit tests (owner: nestjs-developer)
- [x] Products module: public cached list (`page`, `limit`, `search`, `category`, `minPrice`, `maxPrice`, `sort`) and detail by id or slug, ADMIN-only create/update/soft-delete with cache invalidation, prices in integer cents, unit tests (owner: nestjs-developer)
- [x] E2E suite against a dedicated test database + local redis: full auth flow with refresh rotation (reused refresh token rejected), RBAC 403/201, pagination + filters, cache hit + invalidation, throttling 429 (owner: nestjs-developer)
- [x] Update `apps/api/README.md` (endpoints, env vars, Prisma/seed workflow, Swagger) and the root README service table if needed (owner: main)

## Acceptance Criteria

- Monorepo build/lint/test stay green; api unit and e2e suites pass.
- Migrations apply cleanly; the api container migrates on start; seed creates the admin and demo catalog.
- Auth flow proven end to end, including refresh rotation and logout revocation.
- RBAC proven: CUSTOMER blocked (403) and ADMIN allowed (201) on catalog writes.
- Pagination, filtering, and sorting proven by e2e with the documented envelope.
- Cache-aside proven: repeated list served from Redis and invalidated by a write.
- Throttling proven: 429 on the auth bucket.
- Swagger documents every v1 endpoint; errors follow the envelope with correlation IDs and no stack traces.
- Full compose stack (now with redis) comes up healthy end to end.

## Verification

- [x] `pnpm install` — completes without errors
- [x] `pnpm turbo run build lint` — passes for all packages and apps
- [x] `pnpm --filter api test` — unit tests pass
- [x] `docker compose up -d --wait postgres redis` — infra healthy for the e2e run
- [x] `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/mini_ecommerce pnpm --filter api exec prisma migrate deploy` — migrations apply, exit 0
- [x] `pnpm --filter api run test:e2e` — e2e suite passes (auth rotation, RBAC, pagination/filters, cache invalidation, 429)
- [x] `docker compose up -d --wait` — full stack healthy including redis and migrated api
- [x] `curl -fsS http://localhost:8080/api/health` — returns `{"status":"ok","service":"api"}`
- [x] `curl -fsS -o /dev/null -w "%{http_code}" http://localhost:8080/api/docs` — returns `200`
- [x] `curl -fsS http://localhost:8080/api/v1/products` — returns the list envelope with `data` and `meta` (seeded catalog)
- [x] `curl -fsS -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{"name":"x","slug":"x","description":"x","priceCents":1,"categoryId":"00000000-0000-0000-0000-000000000000"}' http://localhost:8080/api/v1/products` — returns `401` (write requires auth)
- [x] `docker compose down -v` — exits 0 (clean teardown)

## Verification notes

- The full-stack check first failed: the running `api` container image was 21 hours old (built during Phase 1, before any Phase 2 code existed), so `/api/docs` 404'd. Rebuilding (`docker compose build api`) surfaced a real Dockerfile bug: the runner stage's `pnpm install --prod` symlinks `@mini-e-commerce/shared`/`@mini-e-commerce/types` as workspace packages but never runs their build script, so `dist/index.js` was missing and the container crashed on boot (`MODULE_NOT_FOUND`). Fixed by copying each package's builder-stage `dist/` output into the runner stage in `apps/api/Dockerfile`. Rebuilt and re-ran every verification command from `docker compose up -d --wait postgres redis` onward; all passed.
