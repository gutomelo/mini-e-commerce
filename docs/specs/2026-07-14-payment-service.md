# Spec: Payment Service (Spring Boot)

- **Date:** 2026-07-14
- **Status:** Approved
- **Phase:** 5

## Overview

Phase 5 turns `apps/payment` from a bare walking-skeleton health check into the real payment bounded context: a Payment domain with its own Postgres database and Flyway migrations, a simulated payment gateway (configurable approve/reject), and QStash-based event integration — a consumer for `order.created` that processes a simulated charge and publishes `payment.completed` or `payment.failed`. This mirrors Phase 4's inventory service almost exactly: since `apps/api` doesn't publish `order.created` until Phase 6, this phase builds and proves the consumer/publisher logic in isolation (hand-crafted signed requests, a fake event publisher for tests), ready for Phase 6 to wire the real producer to an already-working consumer. The idempotency mechanism is designed atomic-claim-first from the start, applying the lesson learned during Phase 4's code review (a check-then-act idempotency check was found to race under concurrent redelivery and had to be fixed to an atomic claim).

## Goals

- **Payment domain**: one row per processed order (`id`, `order_id`, `amount_cents`, `status` — `COMPLETED` or `FAILED`, `gateway_reference` — a simulated transaction id, timestamps) in a dedicated `mini_ecommerce_payment` Postgres database (separate from `apps/api`'s `mini_ecommerce` and `apps/inventory`'s `mini_ecommerce_inventory`, on the same Postgres server/container) — same service-boundary isolation established in Phase 4.
- **Migrations**: schema-versioned via Flyway (`V1__...sql`, `V2__...sql` under `src/main/resources/db/migration`), applied automatically on application startup (Flyway's default Spring Boot behavior) — the Spring Boot equivalent of `apps/api`'s `prisma migrate deploy` and `apps/inventory`'s `cmd/migrate`.
- **Simulated gateway**: approves a charge with a configurable success rate (`PAYMENT_GATEWAY_SUCCESS_RATE`, e.g. `0.9` for 90%), except a reserved sentinel amount (`amount_cents == 66600`, i.e. exactly $666.00) which always fails — giving tests a deterministic way to exercise both the `payment.completed` and `payment.failed` paths without depending on random chance or mocking the RNG. The gateway is a single component behind its own small interface so the "simulated" implementation could later be swapped for a real one without touching the use case that calls it.
- **QStash consumer**: `POST /internal/v1/events/qstash` verifies the Upstash QStash signature (`Upstash-Signature` header) using the QStash signing keys (current and next, both accepted during key rotation), parses the body as an `EventEnvelope<OrderCreatedData>` (event `order.created`, data `{ orderId, totalCents }`), and processes the simulated charge. Idempotent via an atomic claim: a `processed_events` table (keyed by the envelope's `correlationId`) is claimed with a single atomic insert (`INSERT ... ON CONFLICT DO NOTHING`, checked via rows-affected) _before_ any charge processing or event publishing — only the caller that wins the claim proceeds, closing the race Phase 4 had to fix after the fact rather than repeating it.
- **Event publishing**: after processing, publishes exactly one event per processed order — `payment.completed` (`{ orderId, paymentId, amountCents }`) or `payment.failed` (`{ orderId, paymentId, reason }`) — through an `EventPublisher` interface. Two implementations: a real Upstash QStash HTTP client (used in production/compose) and a fake in-memory publisher (used by local dev by default and by all automated tests) — mirrors Phase 4's approach, and is what makes this phase's own verification reproducible without a live Upstash account or a public callback URL.
- **Internal REST API** (not exposed through the reverse proxy, no host port — same isolation as `apps/inventory`), guarded by a shared-secret header (`X-Internal-Api-Key`, same mechanism and env var name as `apps/inventory`, distinct value): `GET /internal/v1/payments/{orderId}` — the payment record for that order, or `404` if no payment has been processed for it yet.
- **Docker/Compose**: `docker-compose.yml`'s existing `postgres` service gains a third database (`mini_ecommerce_payment`, alongside `mini_ecommerce` and `mini_ecommerce_inventory`); the `payment` service gains `PAYMENT_DATABASE_URL` (JDBC form), `INTERNAL_API_KEY`, `PAYMENT_GATEWAY_SUCCESS_RATE`, and the existing `QSTASH_*`/`QSTASH_DESTINATION_URL` env vars (the same QStash signing keys already used by `apps/inventory`, since both are the same Upstash QStash account); `apps/payment/Dockerfile` becomes a real multi-stage Maven build (already produces a runnable jar; no entrypoint script is needed since Flyway migrates automatically on Spring Boot startup — unlike the Go/Node services, there is no separate migrate step to sequence before the app starts).

## Non-Goals

- No real wiring to `apps/api`'s Orders module — `apps/api` does not publish `order.created` until Phase 6; this phase proves the consumer/publisher work via hand-crafted signed test requests, not a live producer.
- No real payment gateway integration (Stripe, etc.) — "simulated" is permanent for this portfolio project, not a placeholder for a future real integration.
- No refunds, partial payments, retries of a failed payment, or any status beyond the initial `COMPLETED`/`FAILED` outcome.
- No synchronous REST call from `apps/api` to payment yet — the internal REST endpoint exists for later inspection/debugging (and potentially Phase 7's admin panel), not for this phase's checkout flow, which remains unaware payment even exists.
- No consumer of `payment.completed`/`payment.failed` — this phase only proves the events are published correctly (via the fake publisher's recorded calls in tests); nothing subscribes to them yet.
- No real Upstash QStash cloud round-trip in this phase's automated verification — same reasoning as Phase 4: no public callback URL or live credentials in local/CI runs; a real Upstash account check is a manual, documented step, not part of `/verify-phase 5`.
- No reconciliation between this service's assumed `order.created` payload (`{ orderId, totalCents }`) and `apps/inventory`'s (`{ orderId, items }`) — both were defined locally, in isolation, ahead of the real producer. Phase 6 defines the canonical `order.created` schema when `apps/api` actually publishes it and reconciles both consumers against it (very likely by simply including both `totalCents` and `items` in one envelope, since neither consumer needs anything the other defined).
- No admin UI for payments (Phase 7, Angular, if ever added — not committed to by the current roadmap).

## Architecture

```text
apps/payment/src/main/java/com/miniecommerce/payment/
  health/                       existing HealthController/HealthResponse (unchanged)
  payment/
    domain/                     Payment entity (JPA), PaymentStatus enum, ProcessedEvent entity
    application/
      port/                     PaymentRepository (a Spring Data JPA repository interface, used
                                 directly as the port — idiomatic for Spring Boot, unlike the Go
                                 service's hand-written repository interface), ProcessedEventRepository,
                                 EventPublisher, PaymentGateway interfaces
      GetPaymentUseCase.java
      ProcessOrderCreatedUseCase.java   claims the correlation id, runs the gateway, persists the
                                        Payment, publishes the outcome event
    infrastructure/
      gateway/                  SimulatedPaymentGateway (success-rate + sentinel-amount logic)
      qstash/                   real EventPublisher (Upstash QStash HTTP client via RestClient),
                                 signature verification (JWT-based, same Upstash scheme validated
                                 in Phase 4 — via a Java JWT library, e.g. jjwt, since there is no
                                 official Upstash Java SDK equivalent to qstash-go)
      fake/                     in-memory EventPublisher for tests/local dev
    presentation/
      PaymentController.java     GET /internal/v1/payments/{orderId}
      QStashWebhookController.java   POST /internal/v1/events/qstash
      InternalApiKeyFilter.java  (or an equivalent Spring Security/servlet filter) — shared-secret
                                 middleware, applied to every route except /health and the QStash
                                 webhook (which authenticates via Upstash-Signature instead, exactly
                                 as in apps/inventory, since QStash cannot send a custom header)
  src/main/resources/db/migration/
    V1__create_payments.sql
    V2__create_processed_events.sql
```

- Request/event flow: controller → use case (application) → ports → infrastructure adapters, matching every other backend service in this monorepo. No business logic in controllers, per the project's Spring Boot rules.
- Persistence uses Spring Data JPA (idiomatic for Spring Boot, unlike the Go service's deliberately framework-light `database/sql` — the project rules ask Go to avoid framework-heavy solutions but impose no such constraint on Spring Boot, which is expected to "follow layered architecture" and use ordinary Spring idioms).
- `mini_ecommerce_payment` is a separate database on the same compose Postgres container (not a new container), exactly like `apps/inventory`'s `mini_ecommerce_inventory` — consistent service-boundary isolation across both non-Node backends.
- Compose network: `payment` → `postgres:5432` (database `mini_ecommerce_payment`). No host port published (unchanged from Phase 1). Host dev tooling connects via the same published `localhost:5433` port, targeting the different database name.
- The shared-secret header is the only application-level access control on the internal REST endpoint, identical in spirit and mechanism to `apps/inventory`'s — appropriate for a service unreachable outside the Compose network.

## Data & Contracts

- **Postgres schema** (`mini_ecommerce_payment`, via Flyway):
  - `payments`: `id` (uuid, PK), `order_id` (text, unique — one payment per order), `amount_cents` (integer), `status` (text: `COMPLETED` | `FAILED`), `gateway_reference` (text — a simulated transaction id, e.g. a random UUID), `created_at`, `updated_at`.
  - `processed_events`: `correlation_id` (text, PK), `processed_at` (timestamptz) — same idempotency-marker shape as `apps/inventory`'s table.
- **REST endpoint** (`/internal/v1`, requires `X-Internal-Api-Key`):
  - `GET /payments/{orderId}` → `200 { "orderId": "...", "status": "COMPLETED", "amountCents": 4999, "gatewayReference": "...", "processedAt": "..." }`, or `404` if no payment exists for that order.
  - Missing/incorrect `X-Internal-Api-Key` → `401` on every route except `GET /health`.
- **QStash webhook**: `POST /internal/v1/events/qstash` — body is an `EventEnvelope<OrderCreatedData>`:
  ```json
  {
    "event": "order.created",
    "correlationId": "uuid",
    "timestamp": "ISO-8601",
    "data": { "orderId": "uuid", "totalCents": 4999 }
  }
  ```
  Verified via the `Upstash-Signature` header; an invalid signature is rejected and never processed. An `event` value other than `order.created` is rejected rather than silently processed (same hardening applied to `apps/inventory` during Phase 4's review). A `correlationId` already claimed in `processed_events` short-circuits to a no-op success response (idempotent redelivery).
- **Published events** (via `EventPublisher`):
  - `payment.completed`: `EventEnvelope<{ orderId: string, paymentId: string, amountCents: number }>`.
  - `payment.failed`: `EventEnvelope<{ orderId: string, paymentId: string, reason: string }>` (`reason` is a short simulated-gateway decline message, e.g. `"Simulated gateway declined the charge"` — not real gateway error taxonomy).
- **Env vars** (`.env.example`, new): `PAYMENT_DATABASE_URL` (JDBC URL, compose default targets the `mini_ecommerce_payment` database on the same Postgres host/port as the other services), `PAYMENT_GATEWAY_SUCCESS_RATE` (default `0.9`), plus reuse of the existing `INTERNAL_API_KEY`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` (same Upstash account as `apps/inventory`) and a new `PAYMENT_QSTASH_DESTINATION_URL` (distinct from `apps/inventory`'s own `QSTASH_DESTINATION_URL`, since each service's webhook has its own external URL).

## Acceptance Criteria

- `./mvnw test` passes for `apps/payment` (unit tests for the use cases and gateway, using fakes/mocks — no real Postgres required for these).
- Migrations apply cleanly to a fresh `mini_ecommerce_payment` database on application startup.
- `GET /internal/v1/payments/{orderId}` returns the correct record for a processed order, `404` for an unknown order, and rejects a request missing `X-Internal-Api-Key`.
- A hand-crafted, correctly signed `order.created` payload with an ordinary amount is processed and results in either a `COMPLETED` or `FAILED` payment record (per the configured success rate) and exactly one corresponding event recorded on the fake publisher.
- A hand-crafted, correctly signed `order.created` payload with `totalCents == 66600` always results in a `FAILED` payment and a `payment.failed` event (deterministic test of the failure path).
- Redelivering the identical signed payload (same `correlationId`) a second time does not create a second payment record or publish a second event (idempotency proven by an atomic-claim test, mirroring Phase 4's fix rather than its original bug).
- An incorrectly signed QStash payload is rejected and never reaches the payment-processing logic.
- An `order.created` payload for an `orderId` that already has a payment record (e.g., a non-identical redelivery with a different correlation id, which should not happen in practice but must not corrupt state if it does) does not create a duplicate `payments` row — enforced by the `order_id` unique constraint, surfaced as a clear conflict rather than an unhandled database exception.
- `docker compose up -d --wait` stays fully green with the new payment database/migration wiring; `payment` still publishes no host port.

## Open Questions

None.
