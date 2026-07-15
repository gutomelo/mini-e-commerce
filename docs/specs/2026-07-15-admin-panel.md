# Spec: Admin Panel (Angular)

- **Date:** 2026-07-15
- **Status:** Approved
- **Phase:** 7

## Overview

Phase 7 turns `apps/admin` from a bare walking-skeleton health check into a real internal tool: an Angular SPA where an `ADMIN` user logs in and manages the catalog (products/categories), reviews customer orders, checks/corrects stock levels, and sees a lightweight dashboard of aggregate counts. It reuses every backend capability already built (auth, RBAC, products/categories CRUD, orders) and adds the two backend gaps this phase's UI needs: an admin-scoped, cross-customer order-listing endpoint in `apps/api`, and a stock read/write proxy in `apps/api` to `apps/inventory` — since project rules forbid a frontend from calling the Go/Spring Boot services directly.

## Goals

- **Admin authentication**: a login screen using the existing `POST /auth/login`; only a successful login whose JWT role claim is `ADMIN` is accepted into the app — a `CUSTOMER` credential is rejected client-side with a clear message even though the API call itself would technically succeed (the API's RBAC guards are the actual enforcement boundary; this is a UX nicety, not a security control). Access token kept in memory (an Angular signal/service, never persisted); refresh token persisted in `localStorage` so a page reload doesn't force a re-login, silently exchanged for a new access token on app bootstrap via the existing `POST /auth/refresh` rotation — mirrors the storefront's session model in spirit, adapted to a client-only SPA (no server to hold an httpOnly cookie).
- **CORS in `apps/api`**: enables CORS for a configured allow-list of origins (`CORS_ORIGINS` env var, comma-separated). Behind the compose reverse proxy, `apps/admin` and `apps/api` share the same origin (`localhost:8080`) so this isn't exercised there — it exists for local `ng serve` dev (Angular dev server on its own port calling `apps/api` directly) and closes a pre-existing gap against the project's own Security rules ("Always implement: ... CORS"), which had no caller needing it until this phase's browser-based SPA.
- **Dashboard**: aggregate counts only, computed client-side from existing list endpoints' pagination `meta.total` — total products (`GET /products?limit=1`), total categories (`GET /categories`), total orders and a breakdown by status (`GET /admin/orders?limit=1` once per status value, or a single call plus client-side tally if the endpoint returns enough to compute it — see Data & Contracts). No new backend aggregation endpoint.
- **Product management**: list (paginated/filterable, reusing `GET /products`), create/edit (`POST`/`PATCH /products`), soft-delete (`DELETE /products/:id`) — all already-existing ADMIN-gated endpoints; the Angular side is new.
- **Category management**: list/create/edit/delete via the existing `GET`/`POST`/`PATCH`/`DELETE /categories` endpoints (delete already fails with `409` if the category still has products — the UI surfaces that error rather than hiding it).
- **Order management (view-only)**: a new `GET /admin/orders` (paginated, filterable by `status`) and `GET /admin/orders/:id` in `apps/api`, both `ADMIN`-only, unscoped by `userId` — reusing `OrderRepository` with a new not-userId-scoped list/get method (same precedent as Phase 6's `findById`). The admin UI lists and inspects any customer's order (id, customer, items, total, status, timestamps) but cannot change its status — status stays exclusively controlled by the event-driven flow built in Phase 6, avoiding a second, conflicting source of truth for order state in this phase.
- **Stock management**: a new `Inventory` module in `apps/api` (`GET /admin/inventory/:productId`, `PATCH /admin/inventory/:productId`), `ADMIN`-only, proxying to `apps/inventory`'s existing internal REST endpoints (`GET`/`PATCH /internal/v1/stock/:productId`) via an HTTP client authenticated with the existing `INTERNAL_API_KEY` — the same shared secret `apps/inventory` already expects, `apps/api` simply becomes an authenticated caller of it for the first time. The admin UI shows current stock per product (on the product list/detail) and lets an admin correct it.
- **Angular architecture**: `core/` (auth service, HTTP interceptors, guards), `shared/` (layout shell, reusable table/pagination/confirm-dialog components), `features/` (`dashboard`, `products`, `categories`, `orders`, `auth`) — per the project's Angular rules. Standalone components, signals for state, Angular Material for tables/forms/dialogs/snackbars (accelerates CRUD screens without hand-building them), a typed `HttpClient` wrapper per feature reusing `@mini-e-commerce/types`' existing `ListResponse<T>`/`SingleResponse<T>`/`ErrorResponse` envelopes.
- **Docker/Compose**: `apps/admin`'s Dockerfile becomes a real multi-stage build (Angular build → static files served by the existing nginx-based runtime image, unchanged from the Phase 1 skeleton's approach) if a build step is currently missing; `docker-compose.yml`'s `admin` service needs no new env vars (the built SPA calls the same-origin `/api/` path through the compose reverse proxy, matching how `apps/web` already reaches `apps/api`).

## Non-Goals

- No order status editing, cancellation, or refund workflow from the admin panel — status remains exclusively driven by Phase 6's event consumer. A future phase may add this if the roadmap calls for it.
- No new backend aggregation/analytics endpoint for the dashboard — counts are derived client-side from existing paginated list endpoints' `meta.total`. Nothing beyond simple counts (no revenue charts, no time-series) is in scope.
- No stock _history_ or audit log — `PATCH /admin/inventory/:productId` sets an absolute quantity (mirroring `apps/inventory`'s own contract exactly); no record of who changed what or when is kept beyond `apps/inventory`'s own `updatedAt`.
- No user management (listing/promoting/banning customers) — out of scope for this phase; the only admin account is the one seeded by `prisma/seed.ts`.
- No real-time updates (WebSockets/polling) — every screen is a manual-refresh/on-navigation fetch, consistent with the rest of this portfolio project's synchronous-REST-first approach.
- No changes to `apps/inventory`'s or `apps/payment`'s own code — `apps/api`'s new `Inventory` module only calls `apps/inventory`'s already-existing internal endpoints as a client; no new endpoint is added to `apps/inventory` itself.
- No offline/PWA support, no i18n/localization — English-only UI, matching the rest of the codebase's American-English-only policy applied to user-facing text as well as code.
- Accepted risk, not addressed: persisting the refresh token in `localStorage` (rather than an httpOnly cookie) carries a theoretical XSS-exfiltration risk. This is a deliberate, documented trade-off for an internal admin SPA with no first-party cookie-serving backend in this architecture — out of scope to redesign session storage in this phase.

## Architecture

```text
apps/admin/src/app/
  core/
    auth/                    AuthService (login/logout/refresh, signal-based auth state),
                              auth.interceptor.ts (attaches Authorization header, retries
                              once on 401 via refresh, matching apps/web's rotation logic),
                              admin.guard.ts (route guard: redirects to /login unless
                              authenticated AND role === 'ADMIN')
    http/                    typed ApiClient wrapping HttpClient, reusing
                              @mini-e-commerce/types envelopes
  shared/
    layout/                  app shell: sidenav + toolbar (Angular Material)
    components/              data-table, confirm-dialog, pagination controls
  features/
    auth/                    login page
    dashboard/                aggregate counts page
    products/                list/create/edit/delete
    categories/               list/create/edit/delete
    orders/                   list (filter by status) + detail (read-only)
    inventory/                stock lookup/correction, reachable from the product list/detail

apps/api/src/
  presentation/
    orders/
      admin-orders.controller.ts   GET /admin/orders, GET /admin/orders/:id (ADMIN-only)
    inventory/
      inventory.module.ts
      inventory.controller.ts     GET /admin/inventory/:productId, PATCH /admin/inventory/:productId
  application/
    orders/
      use-cases/list-all-orders.use-case.ts, get-any-order.use-case.ts
    inventory/
      ports/inventory-client.port.ts   getStock(productId), setStock(productId, quantity)
  infrastructure/
    inventory/
      http-inventory-client.ts    real adapter: HTTP calls to apps/inventory's
                                  /internal/v1/stock/:productId, authenticated with
                                  INTERNAL_API_KEY (same shared secret apps/inventory
                                  already validates)
```

- Frontends-to-NestJS-only rule preserved: `apps/admin` never calls `apps/inventory`/`apps/payment` directly; `apps/api`'s new `Inventory` module is the only new outbound caller of `apps/inventory`'s internal REST surface, using the internal API key already provisioned for exactly this kind of trusted service-to-service call.
- `OrderRepository` gains a not-`userId`-scoped `listAll(filter)`/`findByIdAny(id)` pair (or reuses `findById` from Phase 6 for the single-order case) — same precedent as Phase 6's `findById`: a deliberate, documented exception to the port's usual `userId`-scoping, reachable only from `ADMIN`-gated routes.
- Angular: standalone components (no `NgModule` boilerplate), signals for component/service state (per Angular 17+ best practices), lazy-loaded feature routes.
- Business logic (API calls, state) lives in `core`/feature services, never inside components — components stay presentation-focused, matching the project's Angular rules ("Keep business logic inside services. Components should focus on presentation.").

## Data & Contracts

- **New endpoints** (`/api/v1`, all require `JwtAuthGuard` + `RolesGuard` + `@Roles(ADMIN)`):
  - `GET /admin/orders?page=&limit=&status=` → `{ data: AdminOrderSummaryOutput[], meta }`, where `AdminOrderSummaryOutput` is the existing `OrderSummaryOutput` (`id`, `status`, `totalCents`, `itemCount`, `createdAt`) plus `userId` and `userEmail` — the two fields an admin needs to identify the owning customer, which the customer-facing `OrderSummaryOutput`/`OrderOutput` never needed and stay unchanged. `PrismaOrderRepository` already joins `User` for `findByIdForUser`, so adding the same join to the new admin-scoped query is a small, isolated change.
  - `GET /admin/orders/:id` → `{ data: AdminOrderOutput }`, the existing `OrderOutput` (with line items) plus `userId`/`userEmail` — any customer's order, `404` if the id doesn't exist.
  - `GET /admin/inventory/:productId` → `{ data: { productId, quantity, updatedAt } }` (proxied from `apps/inventory`), `404` if no stock row exists for that product.
  - `PATCH /admin/inventory/:productId` — body `{ quantity: number }` (non-negative integer) → `200` with the updated row (proxied), `400` on a negative/non-integer body (validated at `apps/api`'s DTO layer before ever calling `apps/inventory`, and `apps/inventory` also validates independently since it's a real network hop).
- **Env vars** (`.env.example`, new): `CORS_ORIGINS` — comma-separated allow-list for `apps/api`'s CORS policy (e.g. `http://localhost:4200` for local Angular dev; compose doesn't need an entry since `admin`/`api` share an origin through nginx there).
- **Angular routes**: `/login`, `/` (dashboard, redirects to `/login` if unauthenticated), `/products`, `/products/new`, `/products/:id/edit`, `/categories`, `/orders`, `/orders/:id`, `/inventory/:productId` (or an inline stock-edit dialog from the product list, whichever proves simpler during implementation — a minor UI detail, not an architectural decision).

## Acceptance Criteria

- `pnpm turbo run build lint test --filter=api` passes, including new unit tests for `ListAllOrdersUseCase`/`GetAnyOrderUseCase` and the `InventoryClient` port's HTTP adapter (mocked HTTP calls).
- `pnpm turbo run build lint test --filter=admin` passes (Angular build, ESLint/Angular lint, unit tests for `AuthService`, the auth interceptor's refresh-on-401 behavior, and at least one feature's component).
- Logging in as the seeded admin account succeeds and reaches the dashboard; logging in as a `CUSTOMER` account is rejected by the admin app with a clear message (even though the API technically authenticates it) and never reaches an admin screen.
- The dashboard shows total products, total categories, and total orders (matching the seeded/created data), derived from existing endpoints' `meta.total`.
- An admin can create, edit, and soft-delete a product through the UI, each action reflected by a subsequent list refresh; deleting a category that still has products surfaces the API's `409` as a visible error, not a silent failure or a crash.
- `GET /admin/orders` (exercised via an `apps/api` e2e test) returns orders across more than one customer, paginated, optionally filtered by `status`; `GET /admin/orders/:id` returns any customer's order or `404` for an unknown id; both reject a non-`ADMIN` caller with `403` and an unauthenticated caller with `401`.
- `GET /admin/inventory/:productId` and `PATCH /admin/inventory/:productId` (exercised via an `apps/api` e2e test against a real `apps/inventory` — or, if that's impractical in the e2e harness, a documented mocked-HTTP-adapter test proving the request/response mapping) correctly proxy to `apps/inventory`'s existing internal endpoints and reject non-`ADMIN` callers.
- The admin UI can look up and correct a product's stock quantity, with the change verified by a subsequent lookup.
- `docker compose up -d --wait` stays fully green with the rebuilt `admin` image; `admin` continues to have no host port published directly (reachable only via the nginx reverse proxy, unchanged from Phase 1).

## Open Questions

None.
