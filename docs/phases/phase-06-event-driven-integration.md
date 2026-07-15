# Phase 06 — Event-Driven Integration (E2E)

- **Spec:** [event-driven integration](../specs/2026-07-15-event-driven-integration.md)
- **Roadmap:** [ROADMAP.md](../ROADMAP.md)

## Objective

Turn `apps/api` into the real `order.created` producer that `apps/inventory` and `apps/payment` have been waiting for since Phases 4/5, and close the loop with a new consumer that reacts to `payment.completed`/`payment.failed` to move an order out of `PLACED`. Done means: creating an order publishes a canonical event both existing consumers accept unmodified, a signed payment outcome updates the right order idempotently, an unsigned/invalid payload never reaches processing logic, and both downstream services' own test suites still pass untouched — proving the superset payload is backward-compatible.

## Prerequisites

- [x] Phase 5 is `Done` in [ROADMAP.md](../ROADMAP.md)
- [x] Spec for this phase is `Approved`

## Tasks

- [x] Prisma schema: add `PAID`/`PAYMENT_FAILED` to `OrderStatus`; add a `ProcessedEvent` model with a composite `(correlationId, event)` primary key; generate the migration (owner: nestjs-developer)
- [x] Add `@upstash/qstash` as a dependency; `EventPublisher` port (`publish(event, correlationId, data)`) with two implementations — `FakeEventPublisher` (in-memory recorder, default provider for tests/local dev) and `QStashEventPublisher` (real adapter using `Client.publishJSON`, called once per destination — `QSTASH_DESTINATION_URL` and `PAYMENT_QSTASH_DESTINATION_URL` — with each publish's failure logged and swallowed independently so one destination's failure never blocks the other) (owner: nestjs-developer)
- [x] `ProcessedEventRepository` port (`tryClaim(correlationId, event): Promise<boolean>`) + Prisma-backed implementation using a single atomic `INSERT ... ON CONFLICT DO NOTHING` raw query checked via rows-affected, claimed before any processing — applying the same atomic-claim-first pattern already proven in Phases 4/5, never the check-then-act version Phase 4 had to fix after the fact (owner: nestjs-developer)
- [x] Extend `OrderRepository`: add `findById(id): Promise<Order | null>` (unscoped — the QStash consumer has no `userId` context) and `updateStatus(id, status): Promise<Order>`; implement both in `PrismaOrderRepository` (owner: nestjs-developer)
- [x] Wire `CreateOrderUseCase` to publish `order.created` through `EventPublisher` after the order is persisted: `correlationId` = the new order's `id`, `data` = `{ orderId, totalCents, items: [{ productId, quantity }] }`; a publish failure is caught and logged, never rethrown (the HTTP response and the persisted order are unaffected); update/add unit tests asserting exactly one event is recorded on the fake publisher with the right `correlationId`/`data` shape (owner: nestjs-developer)
- [ ] `HandlePaymentEventUseCase`: claims `(correlationId, event)` via `ProcessedEventRepository.tryClaim` first (a lost claim is a silent no-op, proving idempotent redelivery); on `payment.completed` calls `OrderRepository.updateStatus(orderId, 'PAID')`, on `payment.failed` calls `updateStatus(orderId, 'PAYMENT_FAILED')`; an unknown `orderId` is logged and acknowledged rather than thrown (QStash would otherwise retry forever); unit tests with fakes/mocks for every port (owner: nestjs-developer)
- [ ] `QStashSignatureVerifier` wrapping `@upstash/qstash`'s `Receiver.verify()` (current and next signing key both accepted); `QStashWebhookController` (`POST /api/v1/events/qstash`) verifies the signature before parsing the body, rejects any `event` other than `payment.completed`/`payment.failed` with `400`, and delegates to `HandlePaymentEventUseCase`; no `JwtAuthGuard` on this route (matches every other service's QStash webhook, which authenticates via `Upstash-Signature` instead) (owner: nestjs-developer)
- [ ] Compose/env wiring: add `API_QSTASH_DESTINATION_URL` (default `http://api:3001/api/v1/events/qstash` in compose, `http://localhost:3001/api/v1/events/qstash` in `.env.example`'s host-dev comment) to the `api` service in `docker-compose.yml` and to `.env.example`, reusing the existing `QSTASH_TOKEN`/`QSTASH_CURRENT_SIGNING_KEY`/`QSTASH_NEXT_SIGNING_KEY` (owner: main)
- [ ] e2e test suite proving every acceptance criterion, added to `apps/api`'s existing e2e suite (real Postgres via `mini_ecommerce_test`, no extra env-var gating needed since `apps/api`'s e2e tests already run against a live test database): order creation records exactly one `order.created` event with `correlationId` = order id and both `totalCents`/`items` present; a correctly signed `payment.completed` moves a known order to `PAID`; a correctly signed `payment.failed` moves it to `PAYMENT_FAILED`; redelivering the identical signed payload is a no-op (no error, no double-transition); an incorrectly signed payload is rejected (`401`) and never reaches the use case; an unsupported `event` value is rejected (`400`) (owner: nestjs-developer)
- [ ] Regression check: `apps/inventory` and `apps/payment`'s own test suites still pass unmodified against the superset `order.created` payload shape (owner: main)
- [ ] Update `apps/api/README.md` (new event-publishing behavior, the `EventPublisher`/`ProcessedEventRepository` ports, the QStash webhook endpoint, new env var) and the root README if needed (owner: main)

## Acceptance Criteria

- `pnpm turbo run build lint test --filter=api` passes.
- A new Prisma migration applies cleanly; `OrderStatus` accepts `PAID`/`PAYMENT_FAILED`; `ProcessedEvent` exists with a composite `(correlationId, event)` primary key.
- Creating an order (`POST /api/v1/orders`) results in exactly one `order.created` event recorded by the fake `EventPublisher`, with `correlationId` equal to the created order's `id` and `data` containing `totalCents` and `items` (each item's `productId`/`quantity`).
- A correctly signed `payment.completed` payload for a known `orderId` moves that order's status to `PAID` (verified via `GET /api/v1/orders/:id`).
- A correctly signed `payment.failed` payload for a known `orderId` moves that order's status to `PAYMENT_FAILED`.
- Redelivering the identical signed payload a second time does not error and does not re-apply or undo the status change.
- An incorrectly signed payload to `/api/v1/events/qstash` is rejected (`401`) and never reaches `HandlePaymentEventUseCase`.
- A payload with an `event` other than `payment.completed`/`payment.failed` is rejected (`400`).
- `apps/inventory` and `apps/payment`'s existing test suites still pass unmodified.
- `docker compose up -d --wait` stays fully green with the new `API_QSTASH_DESTINATION_URL` wiring; no new host port is introduced.

## Verification

- [ ] `pnpm install` — completes without errors
- [ ] `pnpm turbo run build lint test --filter=api` — passes (build, eslint, `jest` unit suite including `CreateOrderUseCase`/`HandlePaymentEventUseCase` new tests)
- [ ] `docker compose up -d --wait postgres redis` — infra healthy for the e2e run
- [ ] `pnpm --filter api run test:e2e` — e2e suite passes, including the new order-created-publish and payment-event-consumer cases (signed completed/failed, idempotent redelivery, invalid signature rejection, unsupported event rejection)
- [ ] `(cd apps/inventory && go test ./...)` — inventory's existing suite still passes unmodified against the superset `order.created` payload
- [ ] `(cd apps/payment && PAYMENT_DATABASE_URL="jdbc:postgresql://localhost:5433/mini_ecommerce_payment_test?user=postgres&password=postgres" ./mvnw test)` after `docker compose exec -T postgres psql -U postgres -c "DROP DATABASE IF EXISTS mini_ecommerce_payment_test"` and `docker compose exec -T postgres psql -U postgres -c "CREATE DATABASE mini_ecommerce_payment_test"` — payment's existing suite still passes unmodified against the superset `order.created` payload
- [ ] `docker compose build api` — image builds successfully
- [ ] `docker compose up -d --wait` — full stack healthy with the new `API_QSTASH_DESTINATION_URL` wiring
- [ ] `docker compose down -v` — exits 0 (clean teardown)
