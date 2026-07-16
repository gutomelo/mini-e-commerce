# Spec: Event-Driven Integration (E2E)

- **Date:** 2026-07-15
- **Status:** Approved
- **Phase:** 6

## Overview

Phases 4 and 5 built `apps/inventory` and `apps/payment` as fully working `order.created` consumers, each proven in isolation with hand-crafted, hand-signed QStash payloads — because `apps/api`'s Orders module never actually published anything. Phase 6 closes that loop: `apps/api` becomes the real `order.created` producer, its `CreateOrderUseCase` publishes the canonical event to both already-built consumers after an order is placed, and a new QStash-driven consumer in `apps/api` reacts to `payment.completed`/`payment.failed` to move the order out of `PLACED` into a final state. `inventory.updated` remains unconsumed (as already scoped as a non-goal in Phases 4/5) — inventory's decrement is fire-and-forget and has no bearing on order status. This is the first genuinely end-to-end asynchronous flow in the project: one HTTP request (checkout) fans out into two independent event-driven services, one of which reports back to close the loop, all correlated by a single id carried through every hop.

## Goals

- **Canonical `order.created` payload**: reconciles the two payload shapes each consumer assumed locally (`apps/inventory` expects `{ orderId, items }`; `apps/payment` expects `{ orderId, totalCents }`) into one superset payload — `{ orderId, totalCents, items: [{ productId, quantity }] }` — published once by `apps/api`. Neither existing consumer needs a code change: each already reads only the fields it cares about from an envelope whose `data` shape a JSON body doesn't restrict.
- **Correlation id = order id**: `apps/api` publishes `order.created` with `correlationId` set to the order's own `id` (a UUID already unique per order), rather than minting an unrelated UUID. This keeps the entire flow — `order.created` out, `payment.completed`/`payment.failed` back — traceable by a single id across three services' structured logs, and lets the inbound webhook consumer match a payment outcome back to its order via `correlationId` directly (in addition to the `orderId` already present in the event's `data`).
- **Real `EventPublisher` in `apps/api`**: a port + two implementations — an in-memory fake (default for local dev and all automated tests, matching Phases 4/5) and a real adapter using the official `@upstash/qstash` Node SDK's `Client.publishJSON`. The real adapter publishes the same envelope twice — once to `QSTASH_DESTINATION_URL` (inventory's existing webhook) and once to `PAYMENT_QSTASH_DESTINATION_URL` (payment's existing webhook) — two independent, best-effort HTTP calls rather than a QStash URL Group/topic, keeping configuration entirely inside this repo's env vars rather than requiring external Upstash account setup that can't be verified automatically.
- **`CreateOrderUseCase` publishes after persisting**: once the order is created and repriced, the use case publishes `order.created` through the `EventPublisher` port. A publish failure is logged but does not fail the checkout request or roll back the order — the order simply stays `PLACED` (a portfolio-scoped best-effort guarantee; no outbox/retry pattern, consistent with this project's existing scope boundaries).
- **New order statuses**: `OrderStatus` gains `PAID` and `PAYMENT_FAILED` alongside the existing `PLACED`. A Prisma migration adds the two enum values.
- **QStash consumer in `apps/api`**: `POST /api/v1/events/qstash` verifies the inbound request using `@upstash/qstash`'s `Receiver.verify()` (current and next signing key both accepted) before parsing the body — an invalid signature is rejected and never reaches processing. Rejects any `event` other than `payment.completed`/`payment.failed`. On `payment.completed`, sets the referenced order's status to `PAID`; on `payment.failed`, sets it to `PAYMENT_FAILED`. Idempotent via the same atomic-claim-first pattern already proven in Phases 4/5: a `ProcessedEvent` table claims `(correlationId, event)` with a single atomic insert (`INSERT ... ON CONFLICT DO NOTHING`, Prisma raw query, checked via rows-affected) before any status update — a redelivery of the identical event is a no-op, not a duplicate/conflicting status change. The composite key (not just `correlationId` alone, unlike Phases 4/5's single-event-type consumers) is required because `apps/api`'s webhook accepts two different event types that can legitimately share the same `correlationId` (the order id) without colliding.
- **Docker/Compose**: `apps/api` gains `API_QSTASH_DESTINATION_URL` (the external URL QStash was told to deliver `payment.completed`/`payment.failed` to, e.g. `http://api:3001/api/v1/events/qstash`), reusing the existing `QSTASH_TOKEN`/`QSTASH_CURRENT_SIGNING_KEY`/`QSTASH_NEXT_SIGNING_KEY` (same Upstash account already used by inventory and payment).

## Non-Goals

- No consumer for `inventory.updated` — stays unconsumed, exactly as scoped as a non-goal in Phases 4 and 5. Stock decrementing remains fire-and-forget with no effect on order status.
- No outbox pattern, at-least-once publish guarantee, or retry queue for a failed `order.created` publish — if the real QStash call fails, the order stays `PLACED` and the failure is logged; recovering it is a manual/future concern, not this phase's.
- No stock-availability check at checkout time — `CreateOrderUseCase` still only re-prices from the `Product` table; it does not call `apps/inventory` synchronously to verify stock before accepting an order (unchanged from Phase 3/4's scope).
- No real Upstash QStash cloud round-trip in this phase's automated verification — same reasoning as Phases 4/5: no public callback URL or live credentials in local/CI runs. A real end-to-end Upstash test (creating a real order against a deployed stack) is a manual, documented step, not part of `/verify-phase 6`.
- No order cancellation, refund, or retry-payment flow — `PAYMENT_FAILED` is a terminal status for this phase; nothing currently lets a customer retry or cancel.
- No changes to the storefront (`apps/web`) beyond what already exists — order history already displays `status`; Phase 6 only adds the two new enum values it will start showing. No new UI work (e.g., a "payment failed, retry" page) is in scope.
- No admin-panel visibility into this flow (Phase 7, Angular, not yet built).

## Architecture

```text
apps/api/src/
  domain/orders/order.entity.ts          OrderStatus gains 'PAID' | 'PAYMENT_FAILED'
  domain/events/                          (new) ProcessedEvent-adjacent domain marker, if needed
  application/
    orders/
      use-cases/create-order.use-case.ts  publishes order.created after persisting (unchanged
                                           signature; EventPublisher injected as a new dependency)
      use-cases/handle-payment-event.use-case.ts   (new) claims (correlationId, event), maps
                                           payment.completed/failed to PAID/PAYMENT_FAILED, updates
                                           the order via OrderRepository
    events/
      ports/event-publisher.port.ts       (new) EventPublisher interface: publish(event, correlationId, data)
      ports/processed-event-repository.port.ts   (new) tryClaim(correlationId, event): boolean
  infrastructure/
    events/
      qstash-event-publisher.ts           (new) real adapter — @upstash/qstash Client.publishJSON,
                                           called twice (inventory + payment destinations)
      fake-event-publisher.ts             (new) in-memory recorder, default bean/provider
      qstash-signature-verifier.ts        (new) wraps @upstash/qstash Receiver.verify()
      prisma-processed-event.repository.ts  (new) Prisma-backed ProcessedEventRepository
  presentation/
    events/
      qstash-webhook.controller.ts        (new) POST /api/v1/events/qstash — verifies signature,
                                           dispatches by `event` field to HandlePaymentEventUseCase
      events.module.ts
prisma/
  schema.prisma                           OrderStatus enum +2 values; new ProcessedEvent model
  migrations/                             new migration for both schema changes
```

- Request/event flow (outbound): `OrdersController` → `CreateOrderUseCase` (application) → `OrderRepository.create` (persist) → `EventPublisher.publish('order.created', order.id, {...})` (fire-and-forget, logged on failure). No business logic in the controller, unchanged.
- Request/event flow (inbound): `QStashWebhookController` → signature verification → `HandlePaymentEventUseCase` (application) → `ProcessedEventRepository.tryClaim` (atomic claim) → `OrderRepository` status update. No business logic in the controller, mirroring Phases 4/5's Go/Java consumers.
- `apps/inventory` and `apps/payment` require **no code changes** — their existing `order.created` consumers already read only `items`/`totalCents` respectively from an envelope whose `data` field is untyped JSON on the wire; a superset payload is fully backward-compatible with both.
- `ProcessedEvent` lives in `apps/api`'s own `mini_ecommerce` Postgres database (via Prisma), matching how `apps/inventory` and `apps/payment` each keep their own `processed_events` table in their own database — no cross-service table sharing.
- The QStash webhook route applies no `JwtAuthGuard` (it's not reachable by end users' JWTs; QStash authenticates via `Upstash-Signature`) — consistent with `apps/api`'s existing per-route `@UseGuards` pattern (no global auth guard to work around). It stays behind `ThrottlerGuard` like every other route (default bucket), which is generous enough for redelivery/retry traffic.
- Real vs. fake `EventPublisher`/signature verification wiring: the fake publisher and a permissive test-only path are the default providers (matching Phases 4/5's "fake is the default bean" convention), keeping `/verify-phase 6`'s automated checks free of any live Upstash dependency.

## Data & Contracts

- **Prisma schema changes** (`apps/api`, migration):
  - `enum OrderStatus { PLACED, PAID, PAYMENT_FAILED }` (adds two values to the existing enum).
  - `model ProcessedEvent { correlationId String; event String; processedAt DateTime @default(now()); @@id([correlationId, event]) }` — composite primary key, since `apps/api`'s webhook accepts more than one event type per `correlationId`.
- **Published event** (`order.created`, via `EventPublisher`, `correlationId` = the new order's `id`):
  ```json
  {
    "event": "order.created",
    "correlationId": "<order.id>",
    "timestamp": "ISO-8601",
    "data": {
      "orderId": "<order.id>",
      "totalCents": 4999,
      "items": [{ "productId": "<uuid>", "quantity": 2 }]
    }
  }
  ```
  Delivered as two independent QStash publishes (to `QSTASH_DESTINATION_URL` and `PAYMENT_QSTASH_DESTINATION_URL`) by the real adapter; recorded once per call by the fake adapter in tests.
- **Consumed events** (`POST /api/v1/events/qstash`, verified via `Upstash-Signature`):
  - `payment.completed` → `{ orderId, paymentId, amountCents }` → order status becomes `PAID`.
  - `payment.failed` → `{ orderId, paymentId, reason }` → order status becomes `PAYMENT_FAILED`.
  - Any other `event` value → `400`, never processed.
  - A `(correlationId, event)` pair already present in `ProcessedEvent` → short-circuits to a no-op `200` (idempotent redelivery).
  - An order id referenced by the event that doesn't exist → logged and acknowledged (`200`, since QStash would otherwise retry forever), not a hard error — this should not happen in practice since `apps/api` is the only one that mints order ids and its own `correlationId` equals `orderId`.
- **Env vars** (`.env.example`, new): `API_QSTASH_DESTINATION_URL` (e.g. `http://localhost:3001/api/v1/events/qstash` for host dev, `http://api:3001/api/v1/events/qstash` inside compose) — the URL QStash was told to deliver `apps/api`'s own webhook to, verified against the signed request the same way inventory/payment already do.

## Acceptance Criteria

- `pnpm turbo run build lint test --filter=api` passes, including new unit tests for `CreateOrderUseCase` (now publishing via a fake `EventPublisher`) and `HandlePaymentEventUseCase`.
- A new Prisma migration applies cleanly; `OrderStatus` accepts `PAID`/`PAYMENT_FAILED`; a fresh `ProcessedEvent` table exists with a composite `(correlationId, event)` primary key.
- Creating an order (`POST /api/v1/orders`) results in exactly one `order.created` event recorded by the fake `EventPublisher`, with `correlationId` equal to the created order's `id` and `data` containing both `totalCents` and `items` (each item's `productId`/`quantity`).
- A correctly signed `payment.completed` payload for a known `orderId` moves that order's status to `PAID` (verified via `GET /api/v1/orders/:id`).
- A correctly signed `payment.failed` payload for a known `orderId` moves that order's status to `PAYMENT_FAILED`.
- Redelivering the identical signed `payment.completed` (or `.failed`) payload a second time does not error and does not un-do or re-apply the status change (idempotency proven by a test asserting the order's `updatedAt` doesn't change on the second delivery, or an equivalent no-op check).
- An incorrectly signed payload to `/api/v1/events/qstash` is rejected (`401`) and never reaches `HandlePaymentEventUseCase`.
- A payload with an `event` other than `payment.completed`/`payment.failed` is rejected (`400`).
- `apps/inventory` and `apps/payment`'s existing test suites still pass unmodified — proving the superset `order.created` payload is backward-compatible with both.
- `docker compose up -d --wait` stays fully green with the new `API_QSTASH_DESTINATION_URL` wiring; no new host port is introduced (the webhook lives on `apps/api`'s existing published port, since `apps/api` is the one service meant to be externally reachable).

## Open Questions

None.
