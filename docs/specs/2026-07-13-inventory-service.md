# Spec: Inventory Service (Go)

- **Date:** 2026-07-13
- **Status:** Approved
- **Phase:** 4

## Overview

Phase 4 turns `apps/inventory` from a bare walking-skeleton health check into the real inventory bounded context: a stock domain with its own Postgres database and migrations, a small internal REST surface for querying/updating stock, and QStash-based event integration — a consumer for `order.created` (decrementing stock per line item) and a publisher for `inventory.updated`. Since `apps/api` doesn't publish `order.created` until Phase 6, this phase builds and proves the consumer/publisher logic in isolation (hand-crafted signed requests, a fake event publisher for tests), ready for Phase 6 to wire the real producer to an already-working consumer.

## Goals

- **Stock domain**: one row per product (`product_id`, `quantity`, timestamps) in a dedicated `mini_ecommerce_inventory` Postgres database (separate from `apps/api`'s `mini_ecommerce` database, on the same Postgres server/container) — clean service-boundary isolation, no cross-service FK, independently migratable/splittable later.
- **Migrations**: schema-versioned via `golang-migrate` (plain `.sql` up/down files), applied on container start (mirroring how `apps/api`'s Dockerfile runs `prisma migrate deploy` before starting).
- **Internal REST API** (not exposed through the reverse proxy, no host port — same isolation as today, reachable only inside the Compose network), guarded by a shared-secret header (`X-Internal-Api-Key`, checked against an env var also known to `apps/api` for future use in Phase 7):
  - `GET /internal/v1/stock/:productId` — current quantity for a product; `404` if no stock row exists.
  - `PATCH /internal/v1/stock/:productId` — sets an absolute quantity (the correction path a later phase's admin panel will call through `apps/api`); validates a non-negative integer body.
- **QStash consumer**: `POST /internal/v1/events/qstash` verifies the Upstash QStash signature (`Upstash-Signature` header) using the QStash signing keys, parses the body as an `EventEnvelope<OrderCreatedData>` (event `order.created`), and for each line item decrements that product's stock — clamped at zero (never negative), logging a warning if the requested decrement would have gone below zero rather than erroring the whole event (oversell handling belongs to a later phase, if ever; this phase's stock rows are a best-effort count, not a hard reservation system). Idempotent: a `processed_events` table (keyed by the envelope's `correlationId`) ensures a QStash redelivery of the same event is a no-op, not a double-decrement.
- **Event publishing**: after a successful stock decrement, publishes one `inventory.updated` event per affected product (`{ productId, quantity }` in the `data` field) through an `EventPublisher` port. Two implementations: a real Upstash QStash HTTP client (used in production/compose) and a fake in-memory publisher (used by local dev by default and by all automated tests) — this is what makes the phase's own verification reproducible without a live Upstash account or a public callback URL.
- **Seed script**: a small Go command inserts an initial stock quantity for each of the 12 products already seeded by `apps/api`'s `prisma/seed.ts` (same product ids, read from a small fixture list mirroring that seed data), run once against the inventory database — independent of `apps/api`'s own seeding, matching how that service seeds itself.
- **Docker/Compose**: `docker-compose.yml`'s existing `postgres` service gains a second database (`mini_ecommerce_inventory`, created alongside `mini_ecommerce` on container init — no new container), plus `INVENTORY_DATABASE_URL`, `QSTASH_*`, and `INTERNAL_API_KEY` env vars for the `inventory` service; `apps/inventory/Dockerfile` becomes a real multi-stage Go build that runs migrations + seed before starting, mirroring `apps/api`'s entrypoint pattern.

## Non-Goals

- No real wiring to `apps/api`'s Orders module — `apps/api` does not publish `order.created` until Phase 6; this phase proves the consumer/publisher work via hand-crafted signed test requests, not a live producer.
- No stock reservations, holds, backorder support, or oversell prevention at checkout time — stock is a best-effort counter, decremented on consumption and clamped at zero.
- No synchronous REST call from `apps/api` to inventory yet (e.g., a live stock check during checkout) — the internal REST endpoints exist for Phase 7's admin panel to call through `apps/api`, not for this phase's checkout flow.
- No consumer of `inventory.updated` — this phase only proves the event is published correctly (via the fake publisher's recorded calls in tests); nothing subscribes to it yet.
- No real Upstash QStash cloud round-trip in this phase's automated verification — that requires a public callback URL and live credentials neither available nor reproducible in local/CI runs; a real Upstash account check is a manual, documented step, not part of `/verify-phase 4`.
- No admin UI for stock (Phase 7, Angular).

## Architecture

```text
apps/inventory/
  cmd/server/main.go        wires everything together, starts the HTTP server
  cmd/migrate/main.go       runs golang-migrate up/down (invoked by the entrypoint script and manually)
  cmd/seed/main.go          inserts initial stock for the known seeded product ids
  internal/
    domain/                 Stock entity, ProcessedEvent marker, OrderCreatedData/EventEnvelope types
                             (mirrors packages/types' EventEnvelope shape, hand-typed in Go — no shared
                             codegen between TS and Go for this project's scope)
    application/             ports (StockRepository, ProcessedEventRepository, EventPublisher),
                             use cases (GetStock, SetStock, ConsumeOrderCreated)
    infrastructure/
      postgres/              StockRepository/ProcessedEventRepository implementations (database/sql
                              + a lightweight driver, e.g. pgx — no full ORM, per "avoid framework-heavy
                              solutions")
      qstash/                real EventPublisher (Upstash QStash HTTP client) and signature verification
      fake/                  in-memory EventPublisher for tests/local dev
    presentation/
      http/                  stock query/update handlers, the QStash webhook handler, shared-secret
                              middleware — thin handlers, no business logic (mirrors "controllers stay
                              thin" from the NestJS rules, applied to Go's handler layer)
  migrations/                golang-migrate .sql files
```

- Request/event flow: HTTP handler or QStash webhook handler → use case (application) → ports → infrastructure adapters. No business logic in handlers.
- `mini_ecommerce_inventory` is a separate database on the same compose Postgres container (not a new container) — simplest to operate for a portfolio project while still giving inventory a genuinely independent schema/connection string, consistent with "Repositories must abstract all database access" and "each service must have a single responsibility, responsibilities must never overlap."
- Compose network: `inventory` → `postgres:5432` (database `mini_ecommerce_inventory`). No host port published (unchanged from Phase 1). Host dev tooling connects via the same published `localhost:5433` port, targeting the different database name.
- The shared-secret header is the only application-level access control on the internal REST endpoints; this is intentionally lighter than the public API Gateway's JWT/RBAC (per project rules, aimed at end users), appropriate for a service unreachable outside the Compose network.

## Data & Contracts

- **Postgres schema** (`mini_ecommerce_inventory`, via `golang-migrate`):
  - `stock`: `product_id` (uuid, primary key — no FK to `apps/api`'s `Product` table, different database/service boundary), `quantity` (integer, `>= 0`), `created_at`, `updated_at`.
  - `processed_events`: `correlation_id` (text, primary key), `processed_at` — idempotency marker for consumed QStash events.
- **REST endpoints** (`/internal/v1`, all require `X-Internal-Api-Key`):
  - `GET /stock/:productId` → `200 { "productId": "...", "quantity": 12, "updatedAt": "..." }` or `404` if unknown.
  - `PATCH /stock/:productId` — body `{ "quantity": 20 }` (integer `>= 0`) → `200` with the updated row; `400` on a negative/non-integer body.
  - Missing/incorrect `X-Internal-Api-Key` → `401` on every route except `GET /health` (unauthenticated, matches every other service's health convention).
- **QStash webhook**: `POST /internal/v1/events/qstash` — body is an `EventEnvelope<OrderCreatedData>`:
  ```json
  {
    "event": "order.created",
    "correlationId": "uuid",
    "timestamp": "ISO-8601",
    "data": { "orderId": "uuid", "items": [{ "productId": "uuid", "quantity": 2 }] }
  }
  ```
  Verified via the `Upstash-Signature` header (QStash's signing-key scheme); an invalid signature is `401` and never processed. A `correlationId` already present in `processed_events` short-circuits to `200` without reprocessing (idempotent redelivery).
- **Published event** (`inventory.updated`, via `EventPublisher`): `EventEnvelope<{ productId: string, quantity: number }>` — one per product whose stock changed as a result of a consumed `order.created` event.
- **Env vars** (`.env.example`, new): `INVENTORY_DATABASE_URL` (compose default targets the `mini_ecommerce_inventory` database on the same Postgres host/port as `apps/api`'s `DATABASE_URL`), `INTERNAL_API_KEY` (shared secret, compose-safe dev default), `QSTASH_TOKEN`/`QSTASH_CURRENT_SIGNING_KEY`/`QSTASH_NEXT_SIGNING_KEY` (already present in `.env.example` from Phase 0, unused until now — inventory is the first service to actually read them).

## Acceptance Criteria

- `go vet ./...` and `gofmt -l .` (no output) pass for `apps/inventory`; its Go test suite passes.
- Migrations apply cleanly to a fresh `mini_ecommerce_inventory` database; the inventory container runs them on start (mirroring `apps/api`'s entrypoint pattern).
- The seed command populates stock for all 12 known seeded product ids with a sane default quantity.
- `GET /internal/v1/stock/:productId` returns the correct quantity for a seeded product, `404` for an unknown id, and `401` without the shared-secret header.
- `PATCH /internal/v1/stock/:productId` updates the quantity (verified by a follow-up `GET`), rejects a negative/non-integer body with `400`, and `401`s without the shared-secret header.
- A hand-crafted, correctly signed `order.created` QStash payload decrements the referenced product(s)' stock by the requested quantity (verified via `GET`), and publishes `inventory.updated` for each affected product (verified via the fake publisher's recorded calls in the test suite).
- Redelivering the exact same signed payload (same `correlationId`) a second time does not double-decrement stock (idempotency proven by a test).
- An incorrectly signed QStash payload is rejected with `401` and never reaches the decrement logic.
- A decrement that would take a product's stock below zero clamps at zero rather than going negative or erroring the whole request.
- `docker compose up -d --wait` stays fully green with the new inventory database/migration/seed wiring; `inventory` still publishes no host port.

## Open Questions

None.
