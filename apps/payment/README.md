# payment — Spring Boot Payment Service

Owns the payments bounded context: a Postgres-backed record per processed order, a simulated payment gateway, an internal REST API for querying payment status, and QStash event integration — an idempotent `order.created` consumer that publishes `payment.completed` or `payment.failed`. Java 21, Spring Boot, Maven, Spring Data JPA, Flyway. Internal service, never exposed through the reverse proxy; every non-health, non-webhook route requires a shared secret.

## Run locally

Requires a JDK 21 (`JAVA_HOME` must point at a JDK, not a JRE):

```bash
docker compose up -d --wait postgres   # its own database on the shared Postgres instance
./mvnw spring-boot:run                 # http://localhost:8082 (or: pnpm turbo run dev --filter=payment)
```

Flyway migrates the schema automatically on startup — but only if `mini_ecommerce_payment` already exists (Flyway migrates schema within a database, it cannot create the database itself). Create it once if running outside Docker:

```bash
docker compose exec postgres psql -U postgres -c "CREATE DATABASE mini_ecommerce_payment"
```

The Docker image handles this automatically via `docker-entrypoint.sh` (a `psql`-based check-then-create step before the app starts).

## Health

`GET /health` → `{"status":"ok","service":"payment"}` (unauthenticated). Spring Actuator stays at `/actuator/*`.

## Internal REST API

Requires `X-Internal-Api-Key` (compared in constant time). Not reachable outside the Compose network — no host port is published.

- `GET /internal/v1/payments/{orderId}` → `200 { "orderId", "status", "amountCents", "gatewayReference", "processedAt" }`, or `404` if no payment has been processed for that order yet.

## QStash event integration

- **Consumes** `order.created`: `POST /internal/v1/events/qstash` verifies the `Upstash-Signature` header (JWT-based, via `jjwt`, checked against both the current and next signing key) before the body is ever parsed — an invalid signature never reaches the processing logic. Rejects (`400`) any `event` value other than `order.created`. Idempotent: a `processed_events` table claims the event's `correlationId` via a single atomic `INSERT ... ON CONFLICT DO NOTHING`, checked _before_ any charge processing — a redelivery of the same event is a no-op, not a double charge. An `order.created` payload for an `orderId` that already has a payment (a different `correlationId`, which shouldn't happen in practice) is rejected with `409`, never an unhandled exception.
- **Simulated gateway**: approves a charge with a configurable success rate (`PAYMENT_GATEWAY_SUCCESS_RATE`, default `0.9`), except a reserved sentinel amount — exactly **$666.00** (`totalCents == 66600`) — which always fails, regardless of the configured rate. This gives tests (and manual exploration) a deterministic way to exercise the decline path.
- **Publishes** `payment.completed` or `payment.failed` (exactly one per processed order) through an `EventPublisher` port. Two implementations: `InMemoryEventPublisher` (in-memory recorder, the default bean today since nothing consumes these events yet) and `QStashEventPublisher` (the real Upstash HTTP client, available but not wired as the active bean — swapping it in is a one-line change in `PaymentBeanConfiguration` once a real destination/consumer exists).
- Since `apps/api` doesn't publish `order.created` until a later phase, this consumer is proven with hand-crafted, hand-signed test requests (see `PaymentIntegrationTests`) rather than a live producer or a real Upstash round-trip.

## Environment variables

See the root `.env.example` for defaults. Compose provides safe local values automatically.

- `SERVER_PORT` — HTTP port (default `8082`).
- `PAYMENT_DATABASE_URL` — JDBC URL for this service's own `mini_ecommerce_payment` database (a separate database on the same Postgres instance as `apps/api`'s `mini_ecommerce` and `apps/inventory`'s `mini_ecommerce_inventory`).
- `INTERNAL_API_KEY` — shared secret required on the payments REST endpoint (mapped in compose from a distinct `PAYMENT_INTERNAL_API_KEY` host variable, so payment's secret differs from inventory's).
- `PAYMENT_GATEWAY_SUCCESS_RATE` — fraction of simulated charges approved, excluding the sentinel amount (default `0.9`).
- `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` — used to verify inbound QStash webhook signatures (both accepted, since QStash rotates keys; same Upstash account as `apps/inventory`).
- `QSTASH_TOKEN` — bearer token for the real QStash publisher (unused while `InMemoryEventPublisher` is the active bean).
- `PAYMENT_QSTASH_DESTINATION_URL` — the full external URL QStash was told to deliver this service's webhook to; must match exactly what QStash signed. Distinct from `apps/inventory`'s own destination URL.

## Testing

```bash
./mvnw test                              # unit tests (no database required)
PAYMENT_DATABASE_URL=... ./mvnw test      # also runs the Postgres-backed integration suite
```

`PaymentIntegrationTests` is gated on `PAYMENT_DATABASE_URL` being set — it skips cleanly, not fails, when no test database is configured, so `pnpm turbo run test` never requires Postgres to pass. Every test generates its own random order/correlation ids rather than relying on a shared reset step, so runs stay independent and reruns are idempotent.

## Docker

`docker compose build payment`. Internal-only: reachable as `http://payment:8082` inside the Compose network; no host port.
