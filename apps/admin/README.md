# admin — Angular Admin Panel

`ADMIN`-only internal tool: a dashboard, product/category management, read-only order review, and stock correction — all backed by `apps/api`, which itself proxies stock reads/writes to `apps/inventory` (this SPA never talks to Go/Spring Boot directly, per the project's Service-Oriented Architecture rule). Angular 21, standalone components, signals, Angular Material. Served as a static build under `/admin/` behind the reverse proxy.

> Angular is pinned to v21: Angular 22 requires Node >= 24.15 and TypeScript 6, which conflict with the workspace toolchain (see `docs/decisions/`).

## Run locally

```bash
pnpm turbo run dev --filter=admin   # http://localhost:4200
```

Calling `apps/api` directly from `ng serve`'s own port requires either a dev proxy or `CORS_ORIGINS=http://localhost:4200` set on `apps/api` (see the root `.env.example`) — behind the compose reverse proxy this isn't needed, since `admin`/`api` share an origin there.

## Authentication

Logs in via `apps/api`'s existing `POST /auth/login` (same endpoint the storefront uses) — there is no separate admin login system. The API authenticates any valid credentials regardless of role; this app additionally checks the resulting user's role (`GET /users/me`) and immediately logs out and rejects any non-`ADMIN` account with a visible message, rather than trusting the login call alone.

Session model (a client-only SPA, unlike the storefront's httpOnly cookies):

- Access token: kept in memory only, never persisted; lost on a full page reload.
- Refresh token: persisted in `localStorage`, silently exchanged for a new access token on app bootstrap. This is a deliberate, documented trade-off (see `AuthService`) — there is no first-party backend in this architecture that could set an httpOnly cookie for the admin SPA, and the theoretical XSS-exfiltration risk is accepted for this internal tool.
- An HTTP interceptor attaches `Authorization` to every request and retries exactly once on a `401` via a silent refresh.

## Routes

- `/login` — outside the app shell (no nav chrome).
- `/` — dashboard: aggregate counts (products, categories, orders, orders by status), derived client-side from existing endpoints' `meta.total` — no dedicated backend aggregation endpoint.
- `/products`, `/products/new`, `/products/:id/edit` — catalog CRUD, soft-delete, per-product stock display/correction.
- `/categories`, `/categories/new`, `/categories/:id/edit` — category CRUD; deleting a category that still has products surfaces the API's `409` message verbatim.
- `/orders`, `/orders/:id` — read-only order review across every customer (`GET /admin/orders`), filterable by status. No status-editing control anywhere: order status stays exclusively controlled by the QStash-driven event flow (Phase 6).

Every route except `/login` sits behind `adminGuard`, applied once at the shell's parent route.

## Architecture

```text
src/app/
  core/
    auth/        AuthService, the auth HTTP interceptor, adminGuard
    http/         ApiClient (typed HttpClient wrapper, /api/v1 base path)
  shared/
    layout/      AppShell (toolbar + sidenav, routed layout for every authenticated route)
    components/  ConfirmDialog(+Service), DataTable (generic paginated table)
  features/
    auth/        login page
    dashboard/   aggregate counts
    products/    list/create/edit/delete + stock
    categories/  list/create/edit/delete
    orders/      list/detail (read-only)
```

Feature services own their HTTP calls; components stay presentation-only, per the project's Angular rules.

## Environment variables

None required to run the built app itself — it calls same-origin `/api/v1/...` in every deployed environment. See the root `.env.example` for `CORS_ORIGINS`, needed only for local `ng serve` calling `apps/api` directly.

## Health

In the container, nginx serves `GET /health` → `{"status":"ok","service":"admin"}`.

## Testing

```bash
pnpm --filter admin test    # Vitest unit tests (services, interceptor, components)
pnpm --filter admin lint    # ESLint + angular-eslint
```

## Docker

Built from the repo root: `docker compose build admin`. Served behind the reverse proxy at `http://localhost:8080/admin/`; no host port published directly.
