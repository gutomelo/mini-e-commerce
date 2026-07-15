# api — NestJS API Gateway / BFF

The only backend consumed by the frontends. Implements Clean Architecture layering (`domain/`, `application/`, `infrastructure/`, `presentation/`), JWT authentication with rotated refresh tokens, RBAC, a cached product/category catalog, order placement, and QStash-based event integration. Global prefix: `/api`; versioned routes live under `/api/v1`.

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
- `POST /orders` — authenticated. Re-prices every line item from the current `Product` record (never trusts a client-supplied price); publishes `order.created` after persisting (see "Event-driven integration" below).
- `GET /orders` — authenticated. Paginated, newest-first, scoped to the caller.
- `GET /orders/:id` — authenticated. `404` if the order doesn't exist or belongs to a different user.

Auth routes share a stricter throttle bucket (10 req/min); every other route uses the default bucket (100 req/min).

## Event-driven integration

- **Publishes** `order.created` (correlation id = the new order's own `id`, for end-to-end traceability across services) after an order is persisted, through an `EventPublisher` port: `{ orderId, totalCents, items: [{ productId, quantity }] }` — a superset payload both `apps/inventory` (`items`) and `apps/payment` (`totalCents`) already consume unmodified. Two implementations: `FakeEventPublisher` (in-memory recorder, the active default so `/verify-phase` and local dev never depend on a live Upstash round-trip) and `QStashEventPublisher` (the real adapter, built but not yet wired as the active provider — fans the envelope out to `QSTASH_DESTINATION_URL` and `PAYMENT_QSTASH_DESTINATION_URL` as two independent, best-effort calls). A publish failure is logged, never rethrown — the order is unaffected.
- **Consumes** `payment.completed`/`payment.failed`: `POST /events/qstash` verifies the `Upstash-Signature` header (via `@upstash/qstash`'s `Receiver`, checking both the signature over the raw request body and, when `API_QSTASH_DESTINATION_URL` is set, the signed request's destination-URL claim) before the body is ever processed. Rejects (`400`) any `event` other than `payment.completed`/`payment.failed`. Idempotent: a `ProcessedEvent` table claims `(correlationId, event)` via a single atomic `INSERT ... ON CONFLICT DO NOTHING` — a redelivery is a silent no-op, not a duplicate status change. On `payment.completed` the referenced order's status becomes `PAID`; on `payment.failed`, `PAYMENT_FAILED`. An unknown `orderId` is logged and acknowledged (not thrown), since QStash would otherwise retry forever for a payload it can never successfully process. No `JwtAuthGuard` on this route — QStash authenticates via `Upstash-Signature`, not a user session.
- `inventory.updated` has no consumer in `apps/api` — inventory's stock decrement is fire-and-forget and has no bearing on order status.

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
- `QSTASH_TOKEN` — bearer token for the real `QStashEventPublisher` (unused while `FakeEventPublisher` is the active provider).
- `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` — verify inbound `payment.completed`/`payment.failed` webhook signatures (both accepted, since QStash rotates keys; same Upstash account as `apps/inventory`/`apps/payment`).
- `QSTASH_DESTINATION_URL` / `PAYMENT_QSTASH_DESTINATION_URL` — inventory's/payment's own webhook URLs, used by the real `QStashEventPublisher` adapter to fan `order.created` out to both.
- `API_QSTASH_DESTINATION_URL` — the external URL QStash was told to deliver `apps/api`'s own webhook to; must match exactly what QStash signed.

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
