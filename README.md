# Mini E-Commerce

[![CI](https://github.com/gutomelo/mini-e-commerce/actions/workflows/ci.yml/badge.svg)](https://github.com/gutomelo/mini-e-commerce/actions/workflows/ci.yml)

A portfolio e-commerce monorepo demonstrating modern architecture across multiple stacks: Clean Architecture, event-driven communication, distributed caching, and professional engineering workflow — with intentionally simple functionality.

## Monorepo structure

```text
apps/
├── web/          # Next.js storefront (App Router, Shadcn UI, Tailwind)
├── admin/        # Angular admin panel (Angular Material)
├── api/          # NestJS API Gateway/BFF (auth, products, orders, cache, events)
├── inventory/    # Go inventory service (stock, event consumers)
└── payment/      # Spring Boot payment service (simulated gateway)

packages/
├── config/       # Shared ESLint, Prettier, and TypeScript configs
├── types/        # Shared DTO and event contract types
├── shared/       # Shared utilities (correlation ids, event envelopes)
└── ui/           # Shared React UI components

docs/             # Roadmap, specs, phase checklists, decision records
```

## Services and responsibilities

| Service   | Stack                          | Responsibility                                                                                             |
| --------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| web       | Next.js 16+, React, TypeScript | Customer experience: catalog, cart, checkout, orders                                                       |
| admin     | Angular 21, TypeScript         | Dashboard, product/category management, order review, stock updates                                        |
| api       | NestJS, TypeScript             | Single backend for both frontends: JWT auth, users, products, orders, Redis cache, QStash event publishing |
| inventory | Go                             | Stock queries/updates, idempotent event consumers                                                          |
| payment   | Spring Boot, Java              | Simulated payment gateway, payment records and status                                                      |

Frontends talk only to the NestJS API. Inventory and Payment are independent services integrated through events (Upstash QStash) and REST, tracing every request with a correlation id.

## Infrastructure

PostgreSQL (single instance, migrations only), Upstash Redis (read cache, 5-minute TTL), Upstash QStash (event bus), Docker + Docker Compose, Nginx reverse proxy, Fly.io deployment target.

## Development workflow

Work advances through phases tracked in [docs/ROADMAP.md](docs/ROADMAP.md), each following spec → plan → implement → verify with a blocking verification gate. The workflow is driven by Claude Code skills (see [CLAUDE.md](CLAUDE.md)) and enforced by git hooks:

- **pre-commit** — lint-staged formats staged files with Prettier (ESLint runs via `pnpm lint`).
- **commit-msg** — commitlint enforces [Conventional Commits](https://www.conventionalcommits.org).

## Getting started

Requirements: Node.js >= 22 (with corepack), pnpm 11 (`corepack enable pnpm`), Go 1.25+, JDK 21, Docker + Compose.

```bash
pnpm install        # install all workspace dependencies
pnpm build          # turbo run build across packages/apps
pnpm lint           # turbo run lint
pnpm test           # turbo run test
pnpm format         # prettier --write .
```

Environment variables are documented in [.env.example](.env.example). Copy it to `.env` and fill in real values — real `.env` files are never committed.

## Docker Compose (integration environment)

Production-style images for all five apps behind an Nginx single entrypoint:

```bash
docker compose build          # build the five app images
docker compose up -d --wait   # postgres + apps + proxy, all healthchecked
docker compose down -v        # clean teardown
```

- `http://localhost:8080/` — storefront (web)
- `http://localhost:8080/admin/` — admin panel
- `http://localhost:8080/api/health` — API gateway
- `inventory` and `payment` are internal-only (no host ports) — frontends talk exclusively to the API
- PostgreSQL is published on `localhost:5433` for development tooling (the container listens on 5432 in-network; 5433 avoids clashing with a host PostgreSQL)

Daily development runs outside Docker (`pnpm dev`, `go run ./cmd/server`, `./mvnw spring-boot:run`); Compose is the integration/demo environment mirroring the Fly.io deployment topology (see [Deployment](#deployment) below).

> TypeScript is pinned to the 5.9.x line workspace-wide (`pnpm-workspace.yaml` overrides) until typescript-eslint supports TypeScript >= 6.

## Testing

- **apps/web** and **apps/admin** each have a Playwright e2e suite (`pnpm --filter web run test:e2e`, `pnpm --filter admin run test:e2e`) driving a real browser against real, dedicated dev-server instances and databases — the storefront's covers register → login → catalog → cart → checkout → order history; the admin panel's covers ADMIN login/CUSTOMER rejection, product/category CRUD, cross-customer order review, and stock lookup/correction (the one flow that round-trips through a real `apps/inventory` Go instance).
- **apps/api** has both a Jest unit suite (mocked ports, no real infra) and a Jest e2e suite against a real, dedicated Postgres/Redis (`pnpm --filter api run test:e2e`) covering auth rotation, RBAC, pagination/cache/throttling, the full event-driven order flow, and the admin-only endpoints.
- **apps/inventory** (`go test ./...`) and **apps/payment** (`./mvnw test`) each have their own unit and integration suites, including hand-signed QStash webhook payloads proving idempotent event consumption without depending on a live Upstash account.
- CI (`.github/workflows/ci.yml`) runs `pnpm turbo run build lint test` on every push/PR — the same command that drives every app uniformly, Go and Java included, via their thin `package.json` wrappers.
- `docs/manual-verification/real-event-flow.md` is the one exception: a manual, user-run guide for proving the real (not faked) cross-service event flow against a live Upstash QStash account.

## Deployment

Fly.io is the deployment target: one `fly.toml` per app (`apps/web/fly.toml`, `apps/admin/fly.toml`, `apps/api/fly.toml`, `apps/inventory/fly.toml`, `apps/payment/fly.toml`), mirroring the Compose topology's access rules exactly — `apps/inventory` and `apps/payment` get no public route, reachable only from `apps/api` over Fly's private networking, the same "frontends never reach Go or Spring Boot directly" rule enforced at the deployment layer. See [docs/deployment/fly-io.md](docs/deployment/fly-io.md) for the full app-creation, secrets, and deploy sequence — a manual, user-run guide, since no live Fly.io account is available to execute or verify it automatically here.

## Documentation

- [docs/ROADMAP.md](docs/ROADMAP.md) — phase status (single source of truth)
- [docs/specs/](docs/specs/) — approved specifications
- [docs/phases/](docs/phases/) — executable phase checklists
- [docs/decisions/](docs/decisions/) — decision records
- [docs/deployment/fly-io.md](docs/deployment/fly-io.md) — Fly.io deployment guide
- [docs/manual-verification/real-event-flow.md](docs/manual-verification/real-event-flow.md) — proving the real cross-service event flow against a live Upstash QStash account
