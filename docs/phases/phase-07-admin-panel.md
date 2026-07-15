# Phase 07 — Admin Panel (Angular)

- **Spec:** [admin panel](../specs/2026-07-15-admin-panel.md)
- **Roadmap:** [ROADMAP.md](../ROADMAP.md)

## Objective

Turn `apps/admin` from a bare walking-skeleton health check into a real internal tool: an `ADMIN`-only Angular SPA for managing products, categories, and reviewing orders/stock, backed by two new capabilities in `apps/api` (a cross-customer admin order listing, and a stock read/write proxy to `apps/inventory`) that this phase's UI needs but nothing built before it required. Done means an admin can log in, see aggregate dashboard counts, manage the catalog, browse any customer's orders (read-only), and correct a product's stock — all proven end to end through the compose stack.

## Prerequisites

- [x] Phase 6 is `Done` in [ROADMAP.md](../ROADMAP.md)
- [x] Spec for this phase is `Approved`

## Tasks

- [x] Compose/env wiring: add `CORS_ORIGINS` (comma-separated allow-list, e.g. `http://localhost:4200` for local Angular dev; no compose entry needed since `admin`/`api` share an origin through nginx there), `INVENTORY_BASE_URL` (compose default `http://inventory:8081`), and `INVENTORY_INTERNAL_API_KEY` (mapped from the same `INTERNAL_API_KEY` value `apps/inventory` already validates, since `apps/api` becomes an authenticated caller of it) to the `api` service in `docker-compose.yml` and to `.env.example` (owner: main)
- [x] Admin orders backend: extend `OrderRepository` with a not-`userId`-scoped `listAll(filter)`/`findByIdAny(id)` pair (joins `User` for `userEmail`, same precedent as `findByIdForUser`); `AdminOrderSummaryOutput`/`AdminOrderOutput` (existing shapes plus `userId`/`userEmail`); `ListAllOrdersUseCase`/`GetAnyOrderUseCase`; `AdminOrdersController` (`GET /admin/orders?page=&limit=&status=`, `GET /admin/orders/:id`), both `JwtAuthGuard` + `RolesGuard` + `@Roles(ADMIN)`; unit tests for both use cases (owner: nestjs-developer)
- [x] Inventory proxy backend: `InventoryClient` port (`getStock(productId)`, `setStock(productId, quantity)`) + `HttpInventoryClient` adapter calling `apps/inventory`'s existing `GET`/`PATCH /internal/v1/stock/:productId` with `X-Internal-Api-Key: INVENTORY_INTERNAL_API_KEY` against `INVENTORY_BASE_URL`; `GetStockUseCase`/`SetStockUseCase`; `InventoryController` (`GET`/`PATCH /admin/inventory/:productId`, DTO validating a non-negative integer quantity), both `JwtAuthGuard` + `RolesGuard` + `@Roles(ADMIN)`; enable CORS in `main.ts` reading `CORS_ORIGINS`; unit tests for both use cases and the HTTP adapter (mocked HTTP calls) (owner: nestjs-developer)
- [x] e2e tests for the two new backend surfaces, added to `apps/api`'s existing e2e suite: `GET /admin/orders` returns orders across more than one customer, paginated, filterable by `status`, `401`/`403` for unauthenticated/non-`ADMIN` callers; `GET /admin/orders/:id` returns any customer's order or `404`; the inventory endpoints correctly proxy through a test double for `InventoryClient` (swapped in for the e2e app, since `apps/inventory` has no host port reachable from the Jest process) and reject non-`ADMIN` callers (owner: nestjs-developer)
- [x] Angular tooling: add ESLint + `angular-eslint` flat config and a `lint` script to `apps/admin/package.json` (mirroring `apps/web`'s/`apps/api`'s `eslint.config.mjs` conventions where applicable); add `@angular/material` + `@angular/cdk` and run its schematic (theme, animations) (owner: angular-developer)
- [x] Angular core: `AuthService` (`login`/`logout`/`refreshOnBootstrap`, signal-based auth state exposing the current user/role), `auth.interceptor.ts` (attaches `Authorization`, retries once on `401` via `POST /auth/refresh`, matching `apps/web`'s rotation logic), `admin.guard.ts` (route guard: redirects to `/login` unless authenticated AND role is `ADMIN`), a typed `ApiClient` wrapping `HttpClient` reusing `@mini-e-commerce/types`' `ListResponse`/`SingleResponse`/`ErrorResponse`; unit tests for `AuthService` and the interceptor's refresh-on-401 behavior (owner: angular-developer)
- [ ] Angular shared: app shell layout (Material sidenav + toolbar, nav links to each feature, logout action) and reusable components (data table with pagination, confirm-dialog) under `shared/` (owner: angular-developer)
- [ ] Angular auth feature: `/login` page (Material form, calls `AuthService.login`, shows a clear rejection message for a non-`ADMIN` login without ever reaching an admin screen) (owner: angular-developer)
- [ ] Angular dashboard feature: `/` route (behind `admin.guard`) showing total products, total categories, and total orders (with a status breakdown), each derived client-side from existing endpoints' `meta.total` — no new backend aggregation call (owner: angular-developer)
- [ ] Angular products feature: `/products` (paginated list, search/filter), create/edit form (name, slug, description, price, category), soft-delete with confirm-dialog, inline stock display and a stock-correction action per product (calling the new `/admin/inventory/:productId` endpoints); at least one component unit test (owner: angular-developer)
- [ ] Angular categories feature: `/categories` (list, create/edit/delete with confirm-dialog); a `409` from deleting a category that still has products is surfaced as a visible error, not swallowed (owner: angular-developer)
- [ ] Angular orders feature: `/orders` (list, filter by status, paginated, via `GET /admin/orders`) and `/orders/:id` (read-only detail: customer, items, total, status, timestamps, via `GET /admin/orders/:id`) — no status-editing control anywhere in this feature (owner: angular-developer)
- [ ] Update `apps/admin/README.md` (routes, env vars, auth model, Angular Material/architecture notes) and the root README service table if needed (owner: main)

## Acceptance Criteria

- `pnpm turbo run build lint test --filter=api` passes, including new unit tests for `ListAllOrdersUseCase`/`GetAnyOrderUseCase`, `GetStockUseCase`/`SetStockUseCase`, and `HttpInventoryClient`.
- `pnpm turbo run build lint test --filter=admin` passes (Angular build, lint, unit tests for `AuthService`, the auth interceptor, and at least one feature component).
- Logging in as the seeded admin account reaches the dashboard; logging in as a `CUSTOMER` account is rejected by the admin app with a clear message and never reaches an admin screen.
- The dashboard shows total products, total categories, and total orders matching the seeded/created data.
- An admin can create, edit, and soft-delete a product through the UI; deleting a category that still has products surfaces the API's `409` as a visible error.
- `GET /admin/orders`/`GET /admin/orders/:id` return orders across customers (paginated, filterable by `status`) and reject non-`ADMIN`/unauthenticated callers, proven by the `apps/api` e2e suite.
- `GET`/`PATCH /admin/inventory/:productId` correctly proxy to `apps/inventory`'s contract and reject non-`ADMIN` callers, proven by the `apps/api` e2e suite (against a test double for the live `apps/inventory` call).
- The admin UI can look up and correct a product's stock quantity, verified by a subsequent lookup.
- `docker compose up -d --wait` stays fully green with the rebuilt `admin`/`api` images; `admin` continues to have no host port published directly.

## Verification

- [ ] `pnpm install` — completes without errors
- [ ] `pnpm turbo run build lint test --filter=api` — passes (build, eslint, `jest` unit suite including the new admin-orders/inventory-proxy use-case and adapter tests)
- [ ] `pnpm turbo run build lint test --filter=admin` — passes (Angular build, eslint, unit tests including `AuthService`/interceptor/feature component)
- [ ] `docker compose up -d --wait postgres redis` — infra healthy for the e2e run
- [ ] `pnpm --filter api run test:e2e` — e2e suite passes, including the new admin-orders and inventory-proxy cases (cross-customer listing/filtering, RBAC 401/403, proxy round-trip via test double)
- [ ] `docker compose build admin api` — both images build successfully
- [ ] `docker compose up -d --wait` — full stack healthy with the rebuilt images
- [ ] `curl -fsS http://localhost:8080/admin/ | grep -qi "<app-root"` — admin SPA is served through the reverse proxy
- [ ] `curl -fsS -o /dev/null -w "%{http_code}" http://localhost:8080/api/v1/admin/orders` — returns `401` (admin orders require auth)
- [ ] `docker compose down -v` — exits 0 (clean teardown)
