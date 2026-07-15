# Mini E-Commerce — Roadmap

Single source of truth for phase status. Only `/verify-phase` may set a phase to `Done`.

**Workflow:** `/create-spec` → `/plan-phase` → `/implement-phase` → `/verify-phase`.
A phase may start only when the previous phase is `Done` (blocking gate enforced by `/implement-phase`).

| #   | Phase                          | Spec                                                                     | Checklist                                               | Status      |
| --- | ------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------- | ----------- |
| 0   | Monorepo Foundation            | [pipeline design](specs/2026-07-11-claude-code-pipeline-design.md)       | [phase-00](phases/phase-00-monorepo-foundation.md)      | Done        |
| 1   | Walking Skeleton               | [walking skeleton](specs/2026-07-11-walking-skeleton.md)                 | [phase-01](phases/phase-01-walking-skeleton.md)         | Done        |
| 2   | API Core (NestJS)              | [api core](specs/2026-07-12-api-core.md)                                 | [phase-02](phases/phase-02-api-core.md)                 | Done        |
| 3   | Storefront (Next.js)           | [storefront](specs/2026-07-13-storefront.md)                             | [phase-03](phases/phase-03-storefront.md)               | Done        |
| 4   | Inventory Service (Go)         | [inventory service](specs/2026-07-13-inventory-service.md)               | [phase-04](phases/phase-04-inventory-service.md)        | Done        |
| 5   | Payment Service (Spring Boot)  | [payment service](specs/2026-07-14-payment-service.md)                   | [phase-05](phases/phase-05-payment-service.md)          | Done        |
| 6   | Event-Driven Integration (E2E) | [event-driven integration](specs/2026-07-15-event-driven-integration.md) | [phase-06](phases/phase-06-event-driven-integration.md) | Done        |
| 7   | Admin Panel (Angular)          | [admin panel](specs/2026-07-15-admin-panel.md)                           | [phase-07](phases/phase-07-admin-panel.md)              | Done        |
| 8   | Hardening & Deployment         | [hardening and deployment](specs/2026-07-15-hardening-and-deployment.md) | —                                                       | Not Started |

## Phase summaries

- **Phase 0 — Monorepo Foundation:** Turborepo + pnpm workspaces, ESLint/Prettier/EditorConfig, Husky + lint-staged + commitlint, `packages/` scaffolding (types, config, shared, ui), `.env.example`, root README.
- **Phase 1 — Walking Skeleton:** all 5 apps scaffolded with `/health`, one Dockerfile each, docker-compose (PostgreSQL + Nginx reverse proxy + apps), `docker compose up` fully green.
- **Phase 2 — API Core (NestJS):** Clean Architecture, JWT + refresh + bcrypt, users, products/categories CRUD, pagination/filters, DTO validation, Swagger, rate limiting, migrations, Redis cache with invalidation, correlation IDs, centralized error handling.
- **Phase 3 — Storefront (Next.js):** login, catalog, product details, cart, checkout, order history.
- **Phase 4 — Inventory Service (Go):** stock domain, queries/updates, migrations, QStash consumer, `inventory.updated` publishing.
- **Phase 5 — Payment Service (Spring Boot):** simulated gateway, approve/reject, persistence, `payment.completed`/`payment.failed` publishing.
- **Phase 6 — Event-Driven Integration (E2E):** full `order.created` flow across services via QStash, correlation IDs end to end, order status updates, idempotent consumers.
- **Phase 7 — Admin Panel (Angular):** dashboard, product management, order management, stock updates via the API.
- **Phase 8 — Hardening & Deployment:** tests for critical flows, observability polish, complete docs, Fly.io deployment (Docker), final README.

## Status legend

- **Not Started** — no work done; spec and checklist may not exist yet.
- **In Progress** — set by `/implement-phase` when work begins.
- **Done** — set exclusively by `/verify-phase` after every verification check passes.
