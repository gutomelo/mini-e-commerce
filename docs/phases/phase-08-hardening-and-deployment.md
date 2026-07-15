# Phase 08 — Hardening & Deployment

- **Spec:** [hardening and deployment](../specs/2026-07-15-hardening-and-deployment.md)
- **Roadmap:** [ROADMAP.md](../ROADMAP.md)

## Objective

Close the gaps left open across Phases 0-7 rather than adding new product features: a Playwright suite for `apps/admin` (the one app still covered by unit tests alone), an `EVENT_PUBLISHER_MODE=fake|real` toggle in all three backend services (default `fake`, preserving every existing automated check unchanged) that opts into the real QStash/HTTP adapters already built, a manual guide for exercising the real cross-service flow against a live Upstash QStash account, a GitHub Actions CI workflow, correlation-id propagation on `apps/inventory`'s/`apps/payment`'s plain internal REST routes, Fly.io deployment configuration with a manual deployment guide, and a final README pass. Done means the project is provably working end to end (automated locally, and documented for a real manual run) and ready to publish.

## Prerequisites

- [x] Phase 7 is `Done` in [ROADMAP.md](../ROADMAP.md)
- [x] Spec for this phase is `Approved`

## Tasks

- [x] Env/compose wiring: add `EVENT_PUBLISHER_MODE=fake` to `.env.example` (documented as `fake` default, `real` opt-in) and to `docker-compose.yml`'s `api`, `inventory`, `payment` services (each defaulting to `fake` so compose behavior is unchanged) (owner: main)
- [x] `apps/inventory`: conditional `EventPublisher` wiring in `cmd/server/main.go` selecting `fake.NewEventPublisher()` vs. the existing `qstash.NewEventPublisher(...)` by `EVENT_PUBLISHER_MODE` (default `fake` on any unrecognized/unset value — never silently pick `real`); a correlation-id middleware/wrapper applied to the plain `GET`/`PATCH /internal/v1/stock/:productId` routes (accepts an inbound `X-Correlation-Id`-equivalent header — match `apps/api`'s existing header name exactly — generating a UUID when absent) whose value appears in every `slog` line for that request, mirroring the correlation discipline the QStash event path already has; unit tests for the mode-selection wiring and the correlation-id middleware (owner: go-developer)
- [x] `apps/payment`: conditional `EventPublisher` bean in `PaymentBeanConfiguration` selecting `InMemoryEventPublisher` vs. the existing `QStashEventPublisher` by `EVENT_PUBLISHER_MODE` (same default-to-fake-on-anything-else rule); a correlation-id filter/interceptor applied to the plain `GET /internal/v1/payments/{orderId}` route (same header name, generate-if-absent), included in every log line for that request; unit tests for the mode-selection wiring and the correlation-id filter (owner: spring-developer)
- [ ] `apps/api`: replace `EventsModule`'s hardcoded `FakeEventPublisher` provider with a `useFactory` reading `EVENT_PUBLISHER_MODE` and returning `FakeEventPublisher` or the existing `QStashEventPublisher` (same default-to-fake rule); `HttpInventoryClient` forwards the current request's correlation id (read from the same header/mechanism `apps/api`'s own `correlation-id.middleware.ts` already establishes) as an outbound header on its calls to `apps/inventory`; unit tests for the mode-selection factory and the outbound correlation-id forwarding (owner: nestjs-developer)
- [ ] `apps/admin` Playwright suite: `apps/admin/playwright.config.ts` + `apps/admin/e2e/` mirroring `apps/web`'s existing convention (dedicated `api`/`admin` dev-server pair on their own ports, a dedicated test database reset/reseeded in `globalSetup`, distinct from `apps/web`'s own e2e ports/database to avoid collisions if both suites ever run together) — covering: ADMIN login reaches the dashboard; CUSTOMER login is rejected with a visible message and never reaches an admin screen; create/edit/soft-delete a product, reflected in the list; deleting a category with products shows the API's `409` message; browsing the cross-customer order list and opening a detail page; looking up and correcting a product's stock quantity; `test:e2e` script added to `apps/admin/package.json` (owner: angular-developer)
- [ ] GitHub Actions CI workflow (`.github/workflows/ci.yml`): triggered on push/PR; one job running `pnpm install && pnpm turbo run build lint test` for the TypeScript apps/packages; one job for `apps/inventory` running `go build ./... && go vet ./... && gofmt -l . && go test ./...`; one job for `apps/payment` running `./mvnw -q test` — every command already the same one each phase's own Verification section runs locally, just automated (owner: main)
- [ ] Fly.io deployment configuration: one `fly.toml` per deployable app (`apps/web`, `apps/admin`, `apps/api`, `apps/inventory`, `apps/payment`), reusing each app's existing Dockerfile; `apps/inventory`'s and `apps/payment`'s declare no public HTTP route/service (private-networking-only, matching the "frontends never reach Go/Spring Boot directly" rule at the deployment-topology level); `docs/deployment/fly-io.md` covering app-creation order, `fly secrets set` for every `.env.example` var, and the one-time manual `flyctl deploy` sequence per app (owner: main)
- [ ] `docs/manual-verification/real-event-flow.md`: a manual, user-run guide — create a free Upstash QStash account, expose the compose stack via a public tunnel (e.g. `ngrok http 8080`), configure QStash subscriptions at the tunnel URLs, set `EVENT_PUBLISHER_MODE=real` plus real `QSTASH_*` values, restart the stack, place a real order, and observe (via `apps/admin`) stock decrementing and the order reaching `PAID`/`PAYMENT_FAILED` (owner: main)
- [ ] Final README pass: root `README.md` (drop "future"/"arriving" framing now that Fly.io config and the admin Playwright suite exist, add a Deployment section linking the new guide, add a CI badge), `apps/inventory/README.md` and `apps/payment/README.md` (short correlation-id note) (owner: main)

## Acceptance Criteria

- `pnpm turbo run build lint test --filter=api` and `--filter=admin` pass, including new unit tests for the `EVENT_PUBLISHER_MODE` factory/wiring and correlation-id forwarding.
- `pnpm --filter admin run test:e2e` (Playwright) passes, covering every flow listed in the admin-suite task.
- Every existing `/verify-phase` command from Phases 2-7 still passes unmodified — `EVENT_PUBLISHER_MODE` defaulting to `fake` changes nothing about current default behavior.
- `apps/inventory`'s and `apps/payment`'s Go/Java test suites pass, including new tests proving the mode-selection wiring picks the fake adapter by default and the real adapter only when `EVENT_PUBLISHER_MODE=real`, and that the plain REST routes' logs/responses carry a correlation id.
- `.github/workflows/ci.yml` exists, is valid YAML, and its jobs run the same commands each service's own phase checklist already verifies.
- A `fly.toml` exists for all five apps; `apps/inventory`'s and `apps/payment`'s declare no public HTTP route.
- `docs/deployment/fly-io.md` and `docs/manual-verification/real-event-flow.md` exist, are internally consistent, and contain no TBD/placeholder markers.
- The root README, `apps/inventory/README.md`, and `apps/payment/README.md` reflect every change above.
- `docker compose up -d --wait` stays fully green with every service still defaulting to `EVENT_PUBLISHER_MODE=fake`.

## Verification

- [ ] `pnpm install` — completes without errors
- [ ] `pnpm turbo run build lint test --filter=api` — passes, including the new `EVENT_PUBLISHER_MODE` factory and correlation-id-forwarding unit tests
- [ ] `pnpm turbo run build lint test --filter=admin` — passes (build, lint, unit tests)
- [ ] `docker compose up -d --wait postgres redis` — infra healthy for the e2e runs
- [ ] `pnpm --filter api run test:e2e` — existing api e2e suite still passes unmodified (proves `EVENT_PUBLISHER_MODE` defaulting to `fake` changed nothing)
- [ ] `pnpm --filter admin run test:e2e` — new Playwright suite passes (login/reject-customer, product CRUD, category-delete-409, order list/detail, stock lookup/correction)
- [ ] `(cd apps/inventory && go build ./... && go vet ./... && gofmt -l . && go test ./...)` — passes with no `gofmt` diff, including new mode-selection and correlation-id tests
- [ ] `docker compose exec -T postgres psql -U postgres -c "DROP DATABASE IF EXISTS mini_ecommerce_payment_test"`; `docker compose exec -T postgres psql -U postgres -c "CREATE DATABASE mini_ecommerce_payment_test"`; then `(cd apps/payment && PAYMENT_DATABASE_URL="jdbc:postgresql://localhost:5433/mini_ecommerce_payment_test?user=postgres&password=postgres" ./mvnw test)` — passes, including new mode-selection and correlation-id tests
- [ ] `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` — exits 0 (workflow file is valid YAML)
- [ ] `for app in web admin api inventory payment; do test -f "apps/$app/fly.toml" || echo "MISSING: $app"; done` — prints nothing (every app has a `fly.toml`)
- [ ] `! grep -E "^\[\[services\]\]|^\[http_service\]" apps/inventory/fly.toml apps/payment/fly.toml` — exits 0 (neither declares a public HTTP route/service)
- [ ] `test -f docs/deployment/fly-io.md && test -f docs/manual-verification/real-event-flow.md && ! grep -riE "TBD|TODO|FIXME" docs/deployment/fly-io.md docs/manual-verification/real-event-flow.md` — both docs exist with no placeholder markers
- [ ] `docker compose build` — every image still builds successfully
- [ ] `docker compose up -d --wait` — full stack healthy with every service defaulting to `EVENT_PUBLISHER_MODE=fake` (no `EVENT_PUBLISHER_MODE` override set in the shell/`.env`, so each service's own default applies)
- [ ] `docker compose down -v` — exits 0 (clean teardown)
