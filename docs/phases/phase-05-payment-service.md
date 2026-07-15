# Phase 05 — Payment Service (Spring Boot)

- **Spec:** [payment service](../specs/2026-07-14-payment-service.md)
- **Roadmap:** [ROADMAP.md](../ROADMAP.md)

## Objective

Turn `apps/payment` into the real payment bounded context: a Payment domain with its own Postgres database and Flyway migrations, a simulated gateway (configurable success rate plus a deterministic failure sentinel), and QStash-based event integration — an idempotent `order.created` consumer (atomic claim-first, applying the fix Phase 4 needed to add after the fact) that publishes `payment.completed` or `payment.failed`. Done means every acceptance criterion is proven by an automated check that never depends on a live Upstash account, and the full compose stack stays healthy with `payment` still unreachable from outside the network.

## Prerequisites

- [x] Phase 4 is `Done` in [ROADMAP.md](../ROADMAP.md)
- [x] Spec for this phase is `Approved`

## Tasks

- [x] Compose/env wiring: add `PAYMENT_DATABASE_URL` (JDBC form), `INTERNAL_API_KEY` (mapped from a distinct `PAYMENT_INTERNAL_API_KEY` host var so payment's secret differs from inventory's even though both services read the same in-app variable name), `PAYMENT_GATEWAY_SUCCESS_RATE`, and `PAYMENT_QSTASH_DESTINATION_URL` (reusing the existing `QSTASH_TOKEN`/`QSTASH_CURRENT_SIGNING_KEY`/`QSTASH_NEXT_SIGNING_KEY`, same Upstash account as `apps/inventory`) to the `payment` service in `docker-compose.yml` (`depends_on` healthy `postgres`) and to `.env.example`; document that unlike `apps/inventory`'s Go `cmd/migrate`, Flyway cannot create the database itself — only migrate schema within one that already exists — so database creation needs its own step (see the Dockerfile task) (owner: main)
- [x] Database dependencies + domain: add Spring Data JPA, Flyway, and PostgreSQL driver to `pom.xml`; `Payment` JPA entity + `PaymentStatus` enum (`COMPLETED`/`FAILED`) + `ProcessedEvent` entity; `V1__create_payments.sql`/`V2__create_processed_events.sql` Flyway migrations under `src/main/resources/db/migration` matching the spec's schema exactly (owner: spring-developer)
- [x] Application layer: `PaymentRepository` (Spring Data JPA interface used directly as the port), `ProcessedEventRepository` (with an atomic claim method — `INSERT ... ON CONFLICT DO NOTHING` checked via rows-affected, claimed _before_ any processing, applying Phase 4's post-hoc fix from the start rather than repeating its original bug), `EventPublisher` and `PaymentGateway` interfaces; `GetPaymentUseCase`, `ProcessOrderCreatedUseCase` (claims the correlation id, runs the gateway, persists the `Payment`, publishes the outcome event); unit tests using fakes/mocks for every port (owner: spring-developer)
- [x] Infrastructure adapters: `SimulatedPaymentGateway` (configurable success rate via `PAYMENT_GATEWAY_SUCCESS_RATE`, plus the `amountCents == 66600` sentinel that always fails); a fake in-memory `EventPublisher` (used by tests and local dev by default); a real Upstash QStash `EventPublisher` HTTP client (via `RestClient`) plus JWT-based `Upstash-Signature` verification (a Java JWT library, e.g. `jjwt`, implementing the same signing scheme validated in Phase 4 — current and next signing key both accepted) (owner: spring-developer)
- [x] Presentation layer: `PaymentController` (`GET /internal/v1/payments/{orderId}`), `QStashWebhookController` (`POST /internal/v1/events/qstash` — verifies signature before parsing, rejects an `event` value other than `order.created`, treats an already-claimed `correlationId` as a no-op success), `InternalApiKeyFilter` (or equivalent) applied to every route except `/health` and the QStash webhook (which authenticates via `Upstash-Signature` instead, since QStash cannot send a custom header) (owner: spring-developer)
- [x] Dockerfile/entrypoint: a shell entrypoint that ensures the `mini_ecommerce_payment` database exists (Flyway only migrates schema within an existing database — it cannot create the database itself, unlike `apps/inventory`'s Go `cmd/migrate`) via a `psql`-based check-then-create against the `postgres` maintenance database (add `postgresql-client` to the alpine runtime image), then `exec`s the existing `java -jar` startup — Flyway then runs its own migrations automatically as part of Spring Boot's normal startup; add `lint`/`test` scripts to `apps/payment/package.json` (`./mvnw -q compile`, `./mvnw -q test`) so `pnpm turbo run build lint test --filter=payment` exercises them (owner: spring-developer)
- [x] Test suite proving every acceptance criterion: Spring Boot integration tests (`MockMvc` or `WebTestClient` + a dedicated test database, entirely self-contained with arbitrary order ids) covering: `GET /payments/{orderId}` returns the right record and `404`s for an unknown order; every non-health, non-QStash route `401`s without `X-Internal-Api-Key`; a correctly signed `order.created` payload with an ordinary amount is processed and results in exactly one `payment.completed` or `payment.failed` event on the fake publisher; `totalCents == 66600` always fails; redelivering the identical signed payload does not double-process; an incorrectly signed payload is rejected and never reaches the processing logic; a payload for an `orderId` that already has a payment record surfaces a clear conflict rather than an unhandled exception (owner: spring-developer)
- [x] Update `apps/payment/README.md` (endpoints, env vars, migration workflow, the fake-vs-real `EventPublisher` distinction, the gateway simulation rules) and the root README service table if needed (owner: main)

## Acceptance Criteria

- `./mvnw test` passes for `apps/payment`.
- Migrations apply cleanly to a fresh `mini_ecommerce_payment` database on application startup; the payment container creates the database if missing.
- `GET /internal/v1/payments/{orderId}` returns the correct record for a processed order, `404` for an unknown order, and rejects a request missing `X-Internal-Api-Key`.
- A correctly signed `order.created` payload with an ordinary amount is processed and results in either a `COMPLETED` or `FAILED` payment record (per the configured success rate) and exactly one corresponding event recorded on the fake publisher.
- A correctly signed `order.created` payload with `totalCents == 66600` always results in a `FAILED` payment and a `payment.failed` event.
- Redelivering the identical signed payload (same `correlationId`) does not create a second payment record or publish a second event.
- An incorrectly signed QStash payload is rejected and never reaches the payment-processing logic.
- A payload for an `orderId` that already has a payment record does not create a duplicate `payments` row — surfaced as a clear conflict, not an unhandled database exception.
- `docker compose up -d --wait` stays fully green with the new payment database/migration wiring; `payment` still publishes no host port.

## Verification

- [x] `pnpm install` — completes without errors
- [x] `pnpm turbo run build lint test --filter=payment` — passes (`./mvnw package`, `./mvnw compile`, `./mvnw test`)
- [x] `docker compose up -d --wait postgres` (if not already running); `docker compose exec -T postgres psql -U postgres -c "DROP DATABASE IF EXISTS mini_ecommerce_payment_test"`; `docker compose exec -T postgres psql -U postgres -c "CREATE DATABASE mini_ecommerce_payment_test"`; then `(cd apps/payment && PAYMENT_DATABASE_URL="jdbc:postgresql://localhost:5433/mini_ecommerce_payment_test?user=postgres&password=postgres" ./mvnw test)` — all tests pass, including the Postgres-backed sentinel-amount, idempotent-redelivery, invalid-signature-rejection, and duplicate-order-conflict cases in `PaymentIntegrationTests` (the original command omitted `PAYMENT_DATABASE_URL`, so `PaymentIntegrationTests` silently skipped — 0 tests run — instead of exercising those cases; fixed during `/verify-phase 5` with the user's confirmation)
- [x] `docker compose up -d --wait postgres` — infra healthy for the migration
- [x] `docker compose build payment` — image builds successfully
- [x] `docker compose up -d --wait` — full stack healthy; payment creates its database and migrates automatically on start
- [x] `! docker compose exec -T payment wget -q -O /dev/null http://127.0.0.1:8082/internal/v1/payments/00000000-0000-0000-0000-000000000000` — exits non-zero (rejected: missing `X-Internal-Api-Key`)
- [x] `! docker compose ps payment | grep '0.0.0.0'` — exits 0 (no host port published for the internal service)
- [x] `docker compose down -v` — exits 0 (clean teardown)
