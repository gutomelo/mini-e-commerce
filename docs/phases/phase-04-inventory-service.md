# Phase 04 — Inventory Service (Go)

- **Spec:** [inventory service](../specs/2026-07-13-inventory-service.md)
- **Roadmap:** [ROADMAP.md](../ROADMAP.md)

## Objective

Turn `apps/inventory` into the real inventory bounded context: a stock domain with its own Postgres database and migrations, an internal REST surface for stock queries/corrections guarded by a shared secret, and QStash-based event integration — an idempotent `order.created` consumer (decrementing stock, clamped at zero) and an `inventory.updated` publisher behind a swappable `EventPublisher` port. Done means every acceptance criterion is proven by an automated check that never depends on a live Upstash account, and the full compose stack stays healthy with `inventory` still unreachable from outside the network.

## Prerequisites

- [x] Phase 3 is `Done` in [ROADMAP.md](../ROADMAP.md)
- [x] Spec for this phase is `Approved`

## Tasks

- [x] Compose/env wiring: add `INVENTORY_DATABASE_URL`, `INTERNAL_API_KEY`, and `API_BASE_URL` (for the seed command's slug→id lookup, see task 6) to the `inventory` service in `docker-compose.yml` (`depends_on` healthy `postgres` and `api`) and to `.env.example`; document that the database itself is created idempotently by the migrate command (task 2), not by a Postgres init script, since the existing `pgdata` volume is already initialized from earlier phases and init scripts never re-run against it (owner: main)
- [x] Project layout + migrations: `internal/{domain,application,infrastructure,presentation}` package skeleton; `golang-migrate` `.sql` migrations for `stock` (`product_id` uuid PK, `quantity` int `>= 0`, timestamps) and `processed_events` (`correlation_id` text PK, `processed_at`); `cmd/migrate` that first ensures the `mini_ecommerce_inventory` database exists (connect to the `postgres` maintenance database, `CREATE DATABASE` if not already present — mirrors the check-then-create pattern `apps/api`'s own e2e suite already uses) and then applies migrations; add `lint`/`test` scripts to `apps/inventory/package.json` (`gofmt -l .` + `go vet ./...`, `go test ./...`) so `pnpm turbo run build lint test --filter=inventory` exercises them (owner: go-developer)
- [x] Domain + application layer: `Stock`/`ProcessedEvent` entities, `EventEnvelope`/`OrderCreatedData` types (hand-typed, mirroring `packages/types`' shape), ports (`StockRepository`, `ProcessedEventRepository`, `EventPublisher`), use cases (`GetStock`, `SetStock`, `ConsumeOrderCreated` — decrements per line item clamped at zero, records the `correlationId` in `processed_events`, skips reprocessing if already recorded); unit tests using fake/in-memory port implementations (no real Postgres) (owner: go-developer)
- [x] Infrastructure adapters: Postgres-backed `StockRepository`/`ProcessedEventRepository` (`database/sql` + `pgx`, no ORM); a fake in-memory `EventPublisher` (used by tests and local dev by default); a real Upstash QStash `EventPublisher` HTTP client plus `Upstash-Signature` verification helper (owner: go-developer)
- [x] Presentation layer: HTTP handlers for `GET /internal/v1/stock/:productId`, `PATCH /internal/v1/stock/:productId`, and `POST /internal/v1/events/qstash`; shared-secret middleware (`X-Internal-Api-Key`) applied to every route except `GET /health` (the QStash webhook authenticates via `Upstash-Signature` instead, since QStash cannot send a custom header); wired into `cmd/server/main.go` alongside the existing health handler (owner: go-developer)
- [x] Seed command (`cmd/seed`): a fixture list of the 12 known catalog products keyed by **slug** (not id — `apps/api`'s Prisma seed generates ids dynamically via `@default(uuid())`, only slugs are stable) with a default starting quantity; the command resolves slug → product id by calling `GET {API_BASE_URL}/api/v1/products?limit=100` (the same public, unauthenticated endpoint the storefront uses), then upserts a stock row per resolved id — independent of `apps/api`'s own seeding process, but depends on it having already run (owner: go-developer)
- [x] Dockerfile rewrite: real multi-stage Go build; an entrypoint script that runs `cmd/migrate` then `cmd/seed` before starting `cmd/server`, mirroring `apps/api`'s `docker-entrypoint.sh` pattern (owner: go-developer)
- [x] Test suite proving every acceptance criterion: HTTP-handler-level tests (`net/http/httptest` + a dedicated `mini_ecommerce_inventory_test` Postgres database, entirely self-contained with arbitrary product ids — no dependency on `apps/api` or real catalog data) covering: seeded `GET` returns the right quantity and `404`s for an unknown id; `PATCH` updates and validates (rejects negative/non-integer); every non-health route `401`s without `X-Internal-Api-Key`; a correctly signed `order.created` payload decrements stock and records one `inventory.updated` call per affected product on the fake publisher; redelivering the identical signed payload (same `correlationId`) does not double-decrement; an incorrectly signed payload is rejected with `401` and never reaches the decrement logic; a decrement that would go below zero clamps at zero (owner: go-developer)
- [ ] Update `apps/inventory/README.md` (endpoints, env vars, migration/seed workflow, the fake-vs-real `EventPublisher` distinction) and the root README service table if needed (owner: main)

## Acceptance Criteria

- `gofmt -l .` (no output) and `go vet ./...` pass for `apps/inventory`; `go test ./...` passes.
- Migrations apply cleanly to a fresh `mini_ecommerce_inventory` database; the inventory container creates the database if missing and runs migrations on start.
- The seed command populates stock for all 12 real seeded products (resolved by slug via the API), with a sane default quantity.
- `GET /internal/v1/stock/:productId` returns the correct quantity for a known product, `404` for an unknown id, and rejects a request missing `X-Internal-Api-Key`.
- `PATCH /internal/v1/stock/:productId` updates the quantity (verified by a follow-up `GET`), rejects a negative/non-integer body, and rejects a request missing `X-Internal-Api-Key`.
- A correctly signed `order.created` QStash payload decrements the referenced product(s)' stock and publishes one `inventory.updated` event per affected product (proven via the fake publisher's recorded calls).
- Redelivering the identical signed payload (same `correlationId`) does not double-decrement stock.
- An incorrectly signed QStash payload is rejected and never reaches the decrement logic.
- A decrement that would take stock below zero clamps at zero instead of going negative or erroring the whole request.
- `docker compose up -d --wait` stays fully green with the new inventory database/migration/seed wiring; `inventory` still publishes no host port.

## Verification

- [ ] `pnpm install` — completes without errors
- [ ] `pnpm turbo run build lint test --filter=inventory` — passes (`go build`, `gofmt -l .` clean, `go vet ./...`, `go test ./...`)
- [ ] `(cd apps/inventory && gofmt -l .)` — no output
- [ ] `(cd apps/inventory && go vet ./...)` — exits 0
- [ ] `(cd apps/inventory && go test ./... -v)` — all tests pass, including idempotent-redelivery, invalid-signature-rejection, and clamp-at-zero cases
- [ ] `docker compose up -d --wait postgres api` — infra healthy (postgres + api, the latter needed for the seed command's slug→id lookup)
- [ ] `docker compose build inventory` — image builds successfully
- [ ] `docker compose up -d --wait` — full stack healthy; inventory migrates and seeds automatically on start
- [ ] `! docker compose exec -T inventory wget -q -O /dev/null http://127.0.0.1:8081/internal/v1/stock/00000000-0000-0000-0000-000000000000` — exits non-zero (rejected: missing `X-Internal-Api-Key`)
- [ ] `PRODUCT_ID=$(curl -fsS "http://localhost:8080/api/v1/products?search=Wireless" | python3 -c "import json,sys;print(json.load(sys.stdin)['data'][0]['id'])") && docker compose exec -T inventory wget -qO- --header="X-Internal-Api-Key: $INTERNAL_API_KEY" "http://127.0.0.1:8081/internal/v1/stock/$PRODUCT_ID"` — returns the seeded stock quantity for that product
- [ ] `! docker compose ps inventory | grep '0.0.0.0'` — exits 0 (no host port published for the internal service)
- [ ] `docker compose down -v` — exits 0 (clean teardown)
