# api — NestJS API Gateway / BFF

The only backend consumed by the frontends. Implements Clean Architecture layering (`domain/`, `application/`, `infrastructure/`, `presentation/`), JWT authentication with rotated refresh tokens, RBAC, a cached product/category catalog, and the cross-cutting API standards every later phase builds on. Global prefix: `/api`; versioned routes live under `/api/v1`. Order orchestration and QStash event publishing arrive in later phases.

## Run locally

```bash
docker compose up -d --wait postgres redis   # from the repo root
pnpm turbo run dev --filter=api              # http://localhost:3001/api
```

`prisma generate` runs automatically before `dev`/`build`. Migrations are not applied automatically outside the container — run them yourself against the compose Postgres (see Prisma workflow below).

## Health

`GET /api/health` → `{"status":"ok","service":"api"}` (unversioned, outside URI versioning and excluded from Swagger).

## API documentation

Swagger UI: `http://localhost:3001/api/docs` (or `http://localhost:8080/api/docs` through the compose reverse proxy). Bearer auth is pre-wired — paste an access token to try protected routes.

## Endpoints (`/api/v1`)

- `POST /auth/register` — public. Registers a `CUSTOMER` account.
- `POST /auth/login` — public. Returns `{ accessToken, refreshToken }`.
- `POST /auth/refresh` — public. Rotates a refresh token: the presented token is revoked and a new pair is issued. A reused or revoked refresh token is rejected with `401`.
- `POST /auth/logout` — authenticated. Revokes the presented refresh token.
- `GET /users/me` — authenticated. Returns the caller's profile.
- `GET /categories` — public, cached (`categories:list`, 5 min TTL).
- `POST /categories` / `PATCH /categories/:id` / `DELETE /categories/:id` — `ADMIN` only. Writes invalidate the category cache; deleting a category that still has products fails with `409`.
- `GET /products?page=&limit=&search=&category=&minPrice=&maxPrice=&sort=` — public, cached per normalized query (`products:list:*`). `minPrice`/`maxPrice` are integer cents; `sort` is `<field>:<direction>` (`createdAt`, `price`; `asc`, `desc`; default `createdAt:desc`).
- `GET /products/:idOrSlug` — public, cached (`products:id:<id>` / `products:slug:<slug>`).
- `POST /products` / `PATCH /products/:id` / `DELETE /products/:id` — `ADMIN` only. `DELETE` is a soft delete (`isActive = false`); soft-deleted products are `404` everywhere. Writes invalidate the affected detail keys plus the whole `products:list:*` prefix.

Auth routes share a stricter throttle bucket (10 req/min); every other route uses the default bucket (100 req/min).

## Response envelopes

- List: `{ data: T[], meta: { page, limit, total, totalPages } }`
- Single: `{ data: T }`
- Error: `{ statusCode, error, message, correlationId, timestamp, path }` — never includes a stack trace; every request/response is logged as structured JSON carrying the same `correlationId` (accepts an inbound `x-correlation-id` header or generates one).

## Environment variables

See the root `.env.example` for defaults. Compose provides safe local values automatically.

- `PORT` — HTTP port (default `3001`).
- `DATABASE_URL` — Postgres connection string (compose default targets `localhost:5433` from the host, `postgres:5432` in-container).
- `REDIS_URL` — Redis connection string (compose default `localhost:6380` from the host, `redis:6379` in-container; cache failures degrade gracefully and never break a request).
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — distinct signing secrets for access and refresh tokens.
- `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` — token lifetimes (default `15m` / `7d`).
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — credentials for the admin account created by the seed script.

## Prisma workflow

```bash
# apply migrations against the compose Postgres (from apps/api)
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/mini_ecommerce pnpm exec prisma migrate deploy

# seed the admin user + demo catalog (idempotent, safe to rerun)
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/mini_ecommerce pnpm exec tsx prisma/seed.ts
```

The `api` Docker image runs both steps automatically on container start (see `docker-entrypoint.sh`).

## Testing

```bash
pnpm --filter api test        # unit tests (use cases, adapters — mocked ports, no real infra)
pnpm --filter api test:e2e    # e2e suite — see apps/api/test/README.md for the test-database strategy
```

The e2e suite runs against a dedicated `mini_ecommerce_test` database and an isolated Redis logical DB (both on the same compose services), reset and reseeded automatically before each run.

## Docker

Built from the repo root: `docker compose build api`. Reached through the reverse proxy at `http://localhost:8080/api/`.
