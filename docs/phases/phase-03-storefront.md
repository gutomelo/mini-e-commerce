# Phase 03 — Storefront (Next.js)

- **Spec:** [storefront](../specs/2026-07-13-storefront.md)
- **Roadmap:** [ROADMAP.md](../ROADMAP.md)

## Objective

Turn `apps/web` into the real customer-facing storefront: registration/login with httpOnly-cookie sessions, a browsable product catalog, a client-side cart, and a checkout flow backed by a new Clean Architecture Orders module in `apps/api`. Done means a customer can register, browse, add to cart, check out, and see the resulting order in their history — end to end through the compose stack — with every acceptance criterion from the spec proven by an automated check.

## Prerequisites

- [x] Phase 2 is `Done` in [ROADMAP.md](../ROADMAP.md)
- [x] Spec for this phase is `Approved`

## Tasks

- [x] Add `API_BASE_URL` to `docker-compose.yml` (`web` service environment, compose default `http://api:3001`) and to `.env.example` (local dev default `http://localhost:3001`) (owner: main)
- [x] Orders Prisma schema + migration in `apps/api`: `Order` (`id`, `userId` FK, `status` enum `OrderStatus` with value `PLACED`, `totalCents`, timestamps) and `OrderItem` (`id`, `orderId` FK cascade, `productId` FK no cascade, `productName`, `unitPriceCents`, `quantity`) per the spec's Data & Contracts section (owner: nestjs-developer)
- [x] Orders module in `apps/api` (Clean Architecture, mirrors Products): `OrderRepository` port + Prisma adapter; `CreateOrderUseCase` (re-prices every item from the current `Product` record, rejects inactive/missing products by id, computes `totalCents`, persists scoped to `req.user.sub`), `ListOrdersUseCase`, `GetOrderUseCase` (both scoped to the caller — another user's order id is `EntityNotFoundError`, never `ForbiddenError`); `OrdersController` (`POST /orders`, `GET /orders`, `GET /orders/:id`, all behind `JwtAuthGuard`); unit tests for all three use cases covering the scoping and re-pricing/rejection behavior (owner: nestjs-developer)
- [x] Session/cookie helpers (`apps/web/src/lib/session.ts`) and the `data-access/` layer (`apps/web/src/data-access/`): typed fetch wrappers for auth/products/categories/orders; attach `Authorization` from the `access_token` cookie; on `401`, attempt exactly one silent refresh via `POST /api/v1/auth/refresh` and retry once, else clear both cookies (owner: nextjs-developer)
- [x] Shared UI components in `packages/ui` (Shadcn/Radix/Tailwind): product card, cart badge, form inputs — replacing the Phase 0 placeholder `Button` (owner: nextjs-developer)
- [x] Auth pages and actions: `/register`, `/login` (Server Components + forms bound to Server Actions), `logout` Server Action; on success set `access_token`/`refresh_token` as httpOnly, secure, `SameSite=Lax` cookies; on logout, clear both (owner: nextjs-developer)
- [x] Catalog pages: `/products` (Server Component, `GET /api/v1/products`, `page`/`search`/`category` as URL query params, category options from `GET /api/v1/categories`), `/products/[slug]` detail page (owner: nextjs-developer)
- [x] Cart: `cart` cookie (`{ items: [{ productId, quantity }] }`, no price data), `/cart` page (Server Component shell + small Client Components for quantity/remove) that re-fetches live product data to render (owner: nextjs-developer)
- [x] Checkout: `/checkout` page and Server Action that reads the cart cookie, re-fetches/re-prices every item from the API (dropping inactive/missing products with a clear message), calls `POST /api/v1/orders`, and redirects to an order confirmation view; redirects unauthenticated attempts to `/login` (owner: nextjs-developer)
- [x] Order history: `/orders` (list, `GET /api/v1/orders`) and `/orders/[id]` (detail, `GET /api/v1/orders/:id`), both auth-required (owner: nextjs-developer)
- [x] Playwright e2e suite for `apps/web` against the compose stack, covering: register → login → cookies are httpOnly and session survives reload; a forced-short-lived access token triggers exactly one silent refresh; catalog pagination/filter reflected in the URL; cart add/update/remove without a full page reload; checkout creates an order with correct snapshot totals visible in history; checkout redirects to `/login` when unauthenticated; a stale/tampered cart (deactivated or deleted product) is handled gracefully at checkout; one customer cannot view another's order via `/orders/:id` (owner: nextjs-developer)
- [x] Update `apps/web/README.md` (pages, env vars, auth/cart/checkout flow) and the root README service table if needed (owner: main)

## Acceptance Criteria

- Monorepo build/lint/test stay green; new api unit tests for the three order use cases pass.
- Register → login round-trip works through the storefront UI; access/refresh cookies are httpOnly and the session survives a page reload.
- An expiring access token triggers exactly one silent refresh, transparently to the user.
- Catalog listing shows the seeded products with working pagination and at least one filter (search or category) reflected in the URL.
- Cart add/update/remove works without a full page reload and persists across navigation via the cookie.
- Checkout as an authenticated customer creates an `Order` with snapshot totals matching current product prices, immediately visible in `/orders` and `/orders/:id`.
- Checkout redirects to `/login` when not authenticated.
- A stale/tampered cart referencing a deactivated or deleted product is handled gracefully at checkout, never trusting a client-supplied price.
- One customer cannot view another customer's order via `/orders/:id` (not-found, not a 403).
- `docker compose up -d --wait` stays fully green with the storefront serving real pages through the reverse proxy at `http://localhost:8080/`.

## Verification

- [ ] `pnpm install` — completes without errors
- [ ] `pnpm turbo run build lint test` — passes for all packages and apps, including new api order unit tests
- [ ] `pnpm --filter api test` — unit tests pass (register/login/refresh unaffected; new order use-case tests pass)
- [ ] `docker compose up -d --wait postgres redis` — infra healthy for the migration
- [ ] `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/mini_ecommerce pnpm --filter api exec prisma migrate deploy` — orders migration applies, exit 0
- [ ] `docker compose up -d --wait` — full stack healthy, including the storefront serving real pages
- [ ] `curl -fsS http://localhost:8080/products | grep -qi "Wireless Bluetooth Headphones"` — catalog page renders seeded products through the reverse proxy
- [ ] `curl -fsS -o /dev/null -w "%{http_code}" http://localhost:8080/api/v1/orders` — returns `401` (orders require auth)
- [ ] `pnpm --filter web run test:e2e` — Playwright suite passes: auth cookie flow, silent refresh, catalog filters, cart mutations, checkout (including tampered-cart handling), order history, cross-user order isolation
- [ ] `docker compose down -v` — exits 0 (clean teardown)
