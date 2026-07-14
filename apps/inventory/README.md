# inventory — Go Inventory Service

Owns the stock bounded context: a Postgres-backed stock count per product, a small internal REST API for querying/correcting stock, and QStash event integration — an idempotent `order.created` consumer that decrements stock and an `inventory.updated` publisher. Standard library plus `pgx`, `golang-migrate`, and the official `qstash-go` SDK (signature verification only) — no web framework, no ORM. Internal service, never exposed through the reverse proxy; every non-health route requires a shared secret.

## Run locally

```bash
docker compose up -d --wait postgres api   # postgres for its own DB; api for the seed command's slug lookup
pnpm turbo run dev --filter=inventory      # http://localhost:8081 (go run ./cmd/server)
```

Migrations and seeding aren't automatic outside the container — run them yourself first:

```bash
INVENTORY_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/mini_ecommerce_inventory go run ./cmd/migrate
API_BASE_URL=http://localhost:3001 INVENTORY_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/mini_ecommerce_inventory go run ./cmd/seed
```

The `inventory` Docker image runs both automatically on container start (see `docker-entrypoint.sh`), same pattern as `apps/api`.

## Health

`GET /health` → `{"status":"ok","service":"inventory"}` (unauthenticated).

## Internal REST API

Every route below requires `X-Internal-Api-Key` (compared in constant time). Not reachable outside the Compose network — no host port is published.

- `GET /internal/v1/stock/:productId` → `200 { "productId", "quantity", "updatedAt" }`, or `404` if unknown. `400` on a malformed (non-UUID) id.
- `PATCH /internal/v1/stock/:productId` — body `{ "quantity": N }` (integer, `>= 0`) sets an absolute quantity, creating the row if it doesn't exist. `400` on a negative/non-integer body.

## QStash event integration

- **Consumes** `order.created`: `POST /internal/v1/events/qstash` verifies the `Upstash-Signature` header (via the official `qstash-go` SDK, checked against both the current and next signing key) before ever parsing the body — an invalid signature never reaches the decrement logic. Decrements stock per line item, clamped at zero (never negative; an unknown product is treated as starting from zero rather than erroring the whole event). Idempotent: a `processed_events` table keyed by the event's `correlationId` makes a QStash redelivery of the same event a no-op.
- **Publishes** `inventory.updated` (one event per product whose stock changed) through an `EventPublisher` port. Two implementations: `internal/infrastructure/fake` (in-memory recorder, used by `cmd/server` today since nothing consumes `inventory.updated` yet) and `internal/infrastructure/qstash` (the real Upstash HTTP client, a one-line swap in `cmd/server`'s wiring once a real destination is needed).
- Since `apps/api` doesn't publish `order.created` until a later phase, this consumer is proven with hand-crafted, hand-signed test requests (see `internal/presentation/http/integration_test.go`) rather than a live producer or a real Upstash round-trip.

## Environment variables

See the root `.env.example` for defaults. Compose provides safe local values automatically.

- `PORT` — HTTP port (default `8081`).
- `INVENTORY_DATABASE_URL` — Postgres connection string for this service's own `mini_ecommerce_inventory` database (a separate database on the same Postgres instance as `apps/api`'s `mini_ecommerce`, not a shared schema).
- `INTERNAL_API_KEY` — shared secret required on every route except `/health`.
- `API_BASE_URL` — base URL of the NestJS API; used only by `cmd/seed` to resolve product slugs to ids.
- `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` — used to verify inbound QStash webhook signatures (both are accepted, since QStash rotates keys).
- `QSTASH_TOKEN` — bearer token for the real QStash publisher (not used while `cmd/server` wires the fake publisher by default).
- `QSTASH_DESTINATION_URL` — the full external URL QStash was told to deliver the webhook to; must match exactly what QStash signed.

## Migrations and seeding

```bash
go run ./cmd/migrate   # idempotent: creates the database if missing, applies pending migrations
go run ./cmd/seed      # idempotent: upserts a starting stock quantity for every known seeded product
```

`cmd/migrate` connects to the `postgres` maintenance database to create `mini_ecommerce_inventory` if it doesn't exist yet (Postgres has no `CREATE DATABASE IF NOT EXISTS`), then applies every `golang-migrate` migration under `migrations/` (embedded into the binary via `go:embed`, so no separate file copy is needed at runtime).

`cmd/seed` resolves each of the 12 known catalog product slugs to `apps/api`'s dynamically-generated product id by calling its public `GET /api/v1/products` endpoint (ids aren't fixed across fresh database volumes, only slugs are), then upserts a default stock quantity per resolved product. A slug apps/api hasn't seeded yet is skipped with a warning, not a hard failure.

## Testing

```bash
go test ./...                                          # unit tests (no database required)
INVENTORY_DATABASE_URL=... go test ./...                # also runs Postgres-backed integration tests
```

Postgres-backed tests (repository round-trips, and the full HTTP-handler-level suite in `internal/presentation/http/integration_test.go`) are gated on `INVENTORY_DATABASE_URL` being set — they skip cleanly, not fail, when no test database is configured, so `pnpm turbo run test` never requires Postgres to pass. Each test generates its own random UUID ids rather than relying on a shared reset step, so runs stay independent and reruns are idempotent.

## Docker

`docker compose build inventory`. Internal-only: reachable as `http://inventory:8081` inside the Compose network; no host port.
