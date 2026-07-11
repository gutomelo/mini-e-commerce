# Mini E-Commerce

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
| admin     | Angular 17+, TypeScript        | Dashboard, product/order management, stock updates                                                         |
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

Requirements: Node.js >= 22 (with corepack), pnpm 11 (`corepack enable pnpm`).

```bash
pnpm install        # install all workspace dependencies
pnpm build          # turbo run build across packages/apps
pnpm lint           # turbo run lint
pnpm test           # turbo run test
pnpm format         # prettier --write .
```

Environment variables are documented in [.env.example](.env.example). Copy it to `.env` and fill in real values — real `.env` files are never committed.

> TypeScript is pinned to the 5.9.x line workspace-wide (`pnpm-workspace.yaml` overrides) until typescript-eslint supports TypeScript >= 6.

## Documentation

- [docs/ROADMAP.md](docs/ROADMAP.md) — phase status (single source of truth)
- [docs/specs/](docs/specs/) — approved specifications
- [docs/phases/](docs/phases/) — executable phase checklists
- [docs/decisions/](docs/decisions/) — decision records
