# Spec: Hardening & Deployment

- **Date:** 2026-07-15
- **Status:** Approved
- **Phase:** 8

## Overview

Phase 8 is the final phase: it closes the remaining gaps left open across the previous seven phases rather than adding new product features. Four things land here: a browser-driven Playwright suite for `apps/admin` (the one app still covered by unit tests alone), an env-var-selectable toggle between the fake and real `EventPublisher`/`InventoryClient`-style adapters already built in Phases 4-7 (so the real, cross-service QStash flow can be exercised for the first time, opt-in, without disturbing any existing automated test), a GitHub Actions CI workflow, correlation-id propagation on `apps/inventory`'s and `apps/payment`'s plain internal REST routes (today limited to the QStash event path), and genuinely deployable Fly.io configuration with a manual deployment guide. The project ends this phase provably working end to end, both locally (automated) and for real (documented manual verification against a live Upstash QStash account), and ready to publish.

## Goals

- **`apps/admin` Playwright suite**: a new browser e2e suite (mirroring `apps/web`'s existing Playwright conventions — `playwright.config.ts`, a `test:e2e` script, run against the compose stack) covering: login as the seeded `ADMIN` reaches the dashboard; login as a `CUSTOMER` is rejected with a visible message and never reaches an admin screen; creating/editing/soft-deleting a product through the UI, reflected in a list refresh; deleting a category that still has products shows the API's `409` message; browsing the cross-customer order list and opening a detail page; looking up and correcting a product's stock quantity.
- **Event-publisher/inventory-client mode toggle**: each of `apps/api`, `apps/inventory`, `apps/payment` gains a single environment variable selecting its already-built fake vs. real adapter — `EVENT_PUBLISHER_MODE=fake|real` (default `fake`, preserving every existing automated test/verification unchanged) in all three services. Wiring is a straightforward conditional bean/provider selection (NestJS `useFactory`, a Go `if` in `main.go`'s wiring function, a Spring `@ConditionalOnProperty`/simple `if` in `PaymentBeanConfiguration`) — no profile-switching framework, since the trigger condition the earlier phases' code comments named ("once a real consumer of these events exists") is now true.
- **Manual real end-to-end verification guide**: a new doc (e.g. `docs/manual-verification/real-event-flow.md`) walking through: creating a free Upstash QStash account, obtaining a token and signing keys, exposing the local compose stack's three webhook endpoints via a public tunnel (e.g. `ngrok http 8080`, or three separate tunnels — whichever this project's single-reverse-proxy topology makes simpler), configuring QStash subscriptions pointing at the tunnel URLs, setting `EVENT_PUBLISHER_MODE=real` plus the real `QSTASH_*` env vars, restarting the stack, placing a real order through the storefront or `apps/admin`, and observing (via `apps/admin`'s inventory/orders screens) that stock decrements and the order's status eventually reaches `PAID`/`PAYMENT_FAILED` — proving the real, asynchronous, cross-service flow this whole project has been building toward. This is explicitly a manual, user-run step (the author has no Upstash account or tunnel to verify this automatically) and does not gate `/verify-phase 8`.
- **CI pipeline**: a GitHub Actions workflow (`.github/workflows/ci.yml`) triggered on push/PR, running `pnpm install`, then `pnpm turbo run build lint test` for the TypeScript apps/packages, `go build ./... && go vet ./... && gofmt -l . && go test ./...` for `apps/inventory`, and `./mvnw -q verify` (or `test`) for `apps/payment` — mirroring exactly the checks every phase's own `/verify-phase` already runs locally, just automated on every push. Does not attempt to run the full `docker compose` e2e suites in CI (no Postgres/Redis service containers are provisioned for this phase — running the unit/lint/build checks per service is the actual deliverable; wiring `docker compose`-backed e2e into CI is explicitly out of scope, see Non-Goals).
- **Correlation-id propagation on plain internal REST routes**: `apps/inventory`'s and `apps/payment`'s stock/payment-lookup endpoints (`GET`/`PATCH /internal/v1/stock/:productId`, `GET /internal/v1/payments/{orderId}`) start accepting an inbound correlation-id header (reusing the same header name `apps/api`'s middleware already uses) and generating one when absent, then including it in every structured log line for that request — matching the correlation-discipline these two services already apply to their QStash event-processing paths, and matching `apps/api`'s own per-request correlation-id middleware. `apps/api`'s `HttpInventoryClient` (built in Phase 7) forwards its own current correlation id on outbound calls to `apps/inventory`, so a stock lookup triggered by an admin action carries one traceable id end to end.
- **Fly.io deployment configuration**: one `fly.toml` per deployable app (`web`, `admin`, `api`, `inventory`, `payment`) plus a Postgres/Redis provisioning note (Fly Postgres or an external managed Postgres/Upstash Redis — reusing the Upstash Redis/QStash accounts this project already assumes elsewhere, rather than introducing a new managed-cache decision). `inventory`/`payment` are configured with Fly's private networking (`.internal` DNS) only, no public HTTPS route — preserving the "frontends/public internet never reach Go or Spring Boot directly" rule at the deployment-topology level, not just the reverse-proxy level. A deployment guide (e.g. `docs/deployment/fly-io.md`) covers: app creation order (databases before services, `inventory`/`payment` before `api` so `api` can reach them, `api` before `web`/`admin`), secrets (`fly secrets set`) for every env var currently in `.env.example`, and the one-time manual `flyctl deploy` sequence per app — this is a **documented, user-run deployment**, not something executed or verified automatically in this repo (no live Fly.io account/credentials are available here).
- **Final README pass**: update the root `README.md`'s "Docker Compose" section language (drop "future" framing now that Fly.io config exists), add a "Deployment" section linking the new guide, add a CI badge, and mention the admin Playwright suite alongside the storefront's in the testing overview. `apps/inventory`'s/`apps/payment`'s READMEs get a short correlation-id note matching the change above.

## Non-Goals

- No live Fly.io deployment executed or verified by the author — Fly.io configuration and a deployment guide are the deliverable; actually running `flyctl deploy` against a real account is the user's own follow-up action.
- No live Upstash QStash round-trip in `/verify-phase 8`'s automated checks — same reasoning upheld since Phase 4: no account/credentials available here. The real-flow guide is manual and explicitly non-blocking.
- No CI-driven `docker compose`-backed integration/e2e run (Postgres/Redis/full-stack health checks in GitHub Actions) — provisioning service containers and a Docker-in-Docker-capable runner for every push is real infrastructure work disproportionate to this portfolio project's scope; CI runs the same build/lint/unit-and-existing-mocked-e2e checks every phase already runs locally, nothing new.
- No new observability tooling (OpenTelemetry, Prometheus, Grafana) — the project rules keep the project merely "ready for" future integration with these; Phase 8 polishes what already exists (structured logs, correlation ids, `/health` endpoints), it does not add a metrics/tracing stack.
- No new product features, endpoints, or UI screens beyond what's needed to close the specific gaps above — this phase is entirely about hardening what Phases 0-7 already built.
- No order-status editing, user management, or other feature-level additions to `apps/admin` — the Playwright suite tests what already exists; it does not motivate building anything new in the app itself.
- No change to any service's default runtime behavior — `EVENT_PUBLISHER_MODE` defaults to `fake` everywhere, so every existing `/verify-phase` command from Phases 4-7 continues to pass unmodified.

## Architecture

```text
apps/admin/
  e2e/                              new Playwright suite (mirrors apps/web/e2e/'s structure)
  playwright.config.ts

apps/api/src/infrastructure/events/
  event-publisher.provider.ts        (new) useFactory reading EVENT_PUBLISHER_MODE,
                                      returning FakeEventPublisher or QStashEventPublisher

apps/inventory/cmd/server/main.go    conditional publisher wiring by EVENT_PUBLISHER_MODE;
                                      correlation-id middleware added to the plain stock routes
                                      (the QStash route already threads correlationId from the
                                      event envelope through its own logs)

apps/payment/.../PaymentBeanConfiguration.java
                                      conditional EventPublisher bean by EVENT_PUBLISHER_MODE;
                                      correlation-id filter added to the plain payment-lookup route

.github/workflows/ci.yml             (new) per-service build/lint/test jobs

*/fly.toml                           (new, one per deployable app)
docs/deployment/fly-io.md            (new)
docs/manual-verification/real-event-flow.md   (new)
```

- The `EVENT_PUBLISHER_MODE` toggle is read once at process startup in each service (not per-request), consistent with how every other adapter selection in this codebase already works (a single DI/wiring decision made at boot, e.g. `apps/api`'s existing `EventsModule`).
- `HttpInventoryClient` (already built, Phase 7) gains one addition: it forwards the current request's correlation id as an outbound header, rather than a new component — this is the one piece of `apps/api` code this phase touches for the correlation-id goal.
- Fly.io topology mirrors the compose topology's access rules exactly: only `api`/`web`/`admin` get a public Fly app with an HTTPS route; `inventory`/`payment` are Fly apps reachable only via Fly's private `.internal` networking from `api`, never assigned a public certificate/route.

## Data & Contracts

- **New env var** (`.env.example`, all three backend services): `EVENT_PUBLISHER_MODE=fake` (default; `real` opts into the QStash/HTTP adapters already built in earlier phases). No new contract fields — reuses every `QSTASH_*`/destination-URL var already defined.
- **Correlation-id header**: reuses whatever header name `apps/api`'s existing `correlation-id.middleware.ts` reads/writes (documented there) — `apps/inventory`/`apps/payment` adopt the identical header name on their plain REST routes for consistency; no new contract, just matching the existing one.
- **CI workflow**: no new runtime contract; a GitHub Actions YAML file with one job per service (`api`, `web`, `admin`, `inventory`, `payment`), each running that service's own existing `build`/`lint`/`test` scripts (or Go/Maven equivalents) — the same commands already documented in each phase's Verification section.
- **`fly.toml` files**: one per deployable app, each declaring: the app name, the Dockerfile already built for that service (no new Dockerfile changes expected — reuse Phase 0-7's images as-is unless Fly's runtime requires a trivial adjustment, e.g. `PORT` env var conventions), and (for `inventory`/`payment`) no public `[[services]]`/HTTP route, only Fly's internal DNS.

## Acceptance Criteria

- `pnpm turbo run build lint test --filter=admin` continues to pass; a new `pnpm --filter admin run test:e2e` (Playwright) passes against the compose stack, covering every flow listed in the "`apps/admin` Playwright suite" goal.
- Every existing `/verify-phase` command from Phases 2-7 still passes unmodified — `EVENT_PUBLISHER_MODE` defaulting to `fake` is proven not to have changed any existing service's default behavior.
- Setting `EVENT_PUBLISHER_MODE=real` (with placeholder/dummy QStash credentials, in an isolated manual check — not part of `/verify-phase 8`) causes each service to construct its real adapter instead of the fake one, verified by a unit test per service asserting the correct bean/provider is selected for each mode value.
- `apps/inventory`'s and `apps/payment`'s plain internal REST routes include a correlation id (inbound-forwarded or freshly generated) in their structured logs, verified by a test per service asserting the log output (or an equivalent observable, e.g. a response header) carries the id.
- `.github/workflows/ci.yml` exists and, when inspected/dry-run, would execute the same build/lint/test commands each service's phase checklist already documents (verified by reading the workflow file and cross-checking against those commands — a live GitHub Actions run is outside what `/verify-phase 8` can execute directly, but the workflow's syntax validity and command correctness are checked).
- A `fly.toml` exists for `web`, `admin`, `api`, `inventory`, `payment`; `inventory`'s and `payment`'s declare no public HTTP route.
- `docs/deployment/fly-io.md` and `docs/manual-verification/real-event-flow.md` exist, are internally consistent (no contradictions with the actual env vars/topology built), and have no open TBDs.
- The root README, `apps/inventory/README.md`, and `apps/payment/README.md` reflect the changes above.
- `docker compose up -d --wait` stays fully green with every service still defaulting to `EVENT_PUBLISHER_MODE=fake` — the compose environment's behavior is unchanged from Phase 7.

## Open Questions

None.
