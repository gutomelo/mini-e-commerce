# Spec: Storefront (Next.js)

- **Date:** 2026-07-13
- **Status:** Approved
- **Phase:** 3

## Overview

Phase 3 turns `apps/web` from a bare Next.js scaffold into the customer-facing storefront: registration/login, a browsable product catalog with detail pages, a client-side cart, and a checkout flow that places an order. Since the Inventory (Go) and Payment (Spring Boot) services and QStash event publishing don't exist until Phases 4–6, this phase also adds a minimal **Orders module** to the NestJS API (Clean Architecture, mirroring the products/categories modules from Phase 2) so checkout has something real to persist against — an order is created with status `PLACED` and no stock/payment side effects yet.

## Goals

- **Auth pages**: `/register` and `/login` Server Actions calling `POST /api/v1/auth/register` / `POST /api/v1/auth/login`; on success, set the access and refresh tokens as httpOnly, secure, `SameSite=Lax` cookies on the Next.js response. The browser never sees raw tokens.
- **Session handling**: a `data-access/` layer (`apps/web/src/data-access/`) wraps every call to the NestJS API — attaches `Authorization: Bearer <accessToken>` read from the cookie; on a `401`, attempts exactly one silent refresh via `POST /api/v1/auth/refresh` using the refresh-token cookie, retries the original call once, and otherwise clears both cookies and treats the user as logged out. A `logout` Server Action calls `POST /api/v1/auth/logout` and clears both cookies.
- **Catalog**: `/products` lists products via Server Components fetching `GET /api/v1/products`, with `page`/`search`/`category` exposed as URL query params (shareable/bookmarkable, no client state needed); the category filter's options come from `GET /api/v1/categories`. `/products/[slug]` is the detail page via `GET /api/v1/products/:idOrSlug`.
- **Cart**: client-side only, held in a cookie (`cart`) as a JSON array of `{ productId, quantity }` — no prices, no denormalized product data. A cart icon/page reads current quantities and re-fetches live product data (price, name, image, `isActive`) from the API to render the cart page; adding/removing/updating quantity are Client Component interactions (`useState`/cookie writes) since they're pure browser state, consistent with the "Client Components only when required: state, events" rule.
- **Checkout**: a single Server Action reads the cart cookie, re-fetches each product from the API (authoritative price and `isActive` check — a product removed or deactivated since being added to the cart is dropped with a message, not trusted from client state), and calls `POST /api/v1/orders` with `{ items: [{ productId, quantity }] }`. The API snapshots name/price/quantity per line item at order time and returns the created order; the storefront redirects to an order confirmation page. Requires authentication — an unauthenticated checkout attempt redirects to `/login`.
- **Order history**: `/orders` (auth required) lists the caller's own orders via `GET /api/v1/orders`; `/orders/[id]` shows one order's line items and total via `GET /api/v1/orders/:id`.
- **New API module** (`apps/api`, Clean Architecture, mirrors the Products module): `Order`/`OrderItem` Prisma models, `OrderRepository` port + Prisma adapter, `CreateOrderUseCase` (validates each product exists and `isActive`, snapshots `productName`/`unitPriceCents`/`quantity`, computes `totalCents`, persists with status `PLACED`, scoped to the authenticated user), `ListOrdersUseCase`/`GetOrderUseCase` (scoped to the authenticated user — a customer can only ever see their own orders; `EntityNotFoundError` for another user's order id, not `ForbiddenError`, so existence isn't leaked), unit tests for all three use cases.
- **Shared UI**: extend `packages/ui` with the actual reusable components the storefront needs (product card, cart badge, form inputs) built on Shadcn/Radix/Tailwind per the project rules, replacing the Phase 0 placeholder `Button`.

## Non-Goals

- No stock/inventory checks against the Go service (doesn't exist yet) — `CreateOrderUseCase` only checks `Product.isActive`, not quantity availability.
- No payment integration or QStash event publishing (`order.created` etc. — Phase 6) — an order is simply persisted as `PLACED` and stays there through this phase.
- No order cancellation, editing, or status transitions beyond the initial `PLACED` — those arrive with the event-driven integration in Phase 6.
- No server-persisted cart, wishlist, or saved-for-later — cart is client-side and lost if cookies are cleared, by design (see the accepted trade-off in the confirmed approach).
- No admin-facing order management UI — that's the Angular admin panel (Phase 7).
- No password reset, email verification, or social login — same exclusions as Phase 2's auth scope.
- No product reviews, ratings, or recommendations.

## Architecture

```text
apps/web/src/
  app/
    (auth)/register/page.tsx, login/page.tsx        Server Components + forms bound to Server Actions
    products/page.tsx, products/[slug]/page.tsx      Server Components, fetch from data-access
                                                       (page/search/category as URL query params)
    cart/page.tsx                                    Server Component shell; cart mutation controls are
                                                       small Client Components (quantity stepper, remove)
    checkout/page.tsx                                 Server Component form -> Server Action
    orders/page.tsx, orders/[id]/page.tsx             Server Components (auth required)
  actions/            register, login, logout, checkout Server Actions (cookie writes happen only here)
  data-access/         typed fetch wrappers per resource (auth, products, categories, orders);
                       owns the 401 -> refresh-once -> retry logic and Authorization header attachment
  lib/session.ts       cookie read/write helpers (access/refresh token, cart), shared by data-access
                       and actions

apps/api/src/
  domain/orders/        Order, OrderItem, OrderStatus entities (decoupled from Prisma)
  application/orders/    ports (OrderRepository), use cases (CreateOrder, ListOrders, GetOrder)
  infrastructure/orders/ PrismaOrderRepository
  presentation/orders/   OrdersController, DTOs, OrdersModule (imports AuthModule for JwtAuthGuard;
                         imports the products feature's ProductRepository export to validate/price items)
```

- Request flow for checkout mirrors every other write path from Phase 2: controller → use case (application) → ports → infrastructure adapters; no business logic in controllers or in the Next.js Server Actions beyond calling `data-access`.
- The storefront never talks to Postgres/Redis directly and never calls the Go or Spring Boot services — only the NestJS API, per the project's service-boundary rule. All API calls go through the compose reverse proxy in production/compose (`http://api:3001` in-container) and `NEXT_PUBLIC_API_BASE_URL`/`API_BASE_URL` env vars for local dev, following the existing `.env.example` pattern (server-side fetches use a non-public `API_BASE_URL`; nothing about the API base URL needs to be exposed to the browser since all calls are server-side).
- Cache: catalog reads already benefit from the API's Redis cache-aside (Phase 2); the storefront adds no caching of its own beyond Next.js's default per-request fetch behavior, keeping this phase's scope to the UI/BFF layer only.

## Data & Contracts

- **Prisma models** (`apps/api/prisma/schema.prisma`, new migration):
  - `Order`: `id` (uuid), `userId` (FK to `User`), `status` (enum `OrderStatus`, one value for now: `PLACED`), `totalCents` (int), timestamps.
  - `OrderItem`: `id`, `orderId` (FK, cascade delete), `productId` (FK to `Product`, no cascade — historical reference), `productName` (snapshot, string), `unitPriceCents` (snapshot, int), `quantity` (int, min 1).
- **Endpoints** (new, under `/api/v1`, all require authentication):
  - `POST /orders` — body `{ items: [{ productId: string, quantity: number }] }` (1+ items, quantity ≥ 1); re-prices every item server-side from the current `Product` record, drops/rejects inactive or missing products (`EntityNotFoundError` naming the offending id), computes `totalCents`, persists the order for `req.user.sub`, returns `SingleResponse<OrderDto>` (`201`).
  - `GET /orders` — returns the caller's own orders, `ListResponse<OrderSummaryDto>` (paginated the same way as products: `page`/`limit`, default sort newest-first).
  - `GET /orders/:id` — returns one of the caller's own orders with full line items, `SingleResponse<OrderDto>`; `404` (via `EntityNotFoundError`) if the id doesn't exist or belongs to another user.
- **DTOs**: `OrderDto { id, status, totalCents, items: [{ productId, productName, unitPriceCents, quantity }], createdAt }`; `OrderSummaryDto { id, status, totalCents, itemCount, createdAt }`.
- **Storefront cookies**: `access_token`, `refresh_token` (httpOnly, secure, `SameSite=Lax`, path `/`); `cart` (JSON `{ items: [{ productId, quantity }] }`, NOT httpOnly since client components read/write it directly, but never holds price data so tampering only affects which product ids/quantities are proposed — checkout always re-prices from the API).
- **Env vars** (`.env.example`, new): `API_BASE_URL` (server-side base URL the Next.js app uses to reach the API — compose default `http://api:3001`, local dev default `http://localhost:3001`).

## Acceptance Criteria

- `pnpm turbo run build lint test` passes; new api unit tests for the three order use cases pass.
- Register → login round-trip works end to end through the storefront UI; cookies are httpOnly (verified via browser devtools — not readable from `document.cookie`) and the session survives a page reload.
- An expired/soon-to-expire access token triggers exactly one silent refresh (verified by forcing a short `JWT_ACCESS_TTL` in a manual check) without the user noticing a logout.
- Catalog listing shows the seeded products with working pagination and at least one filter (search or category) reflected in the URL.
- Adding items to the cart, adjusting quantity, and removing an item all work without a page reload feeling broken (cart state persists across a page navigation via the cookie).
- Checkout as an authenticated customer creates an `Order` with correct snapshot totals matching current product prices, visible immediately in `/orders` and `/orders/:id`.
- Checkout is blocked (redirected to `/login`) when not authenticated.
- A tampered/stale cart referencing a deactivated or deleted product is handled gracefully at checkout (item dropped or checkout rejected with a clear message), never trusting a client-supplied price.
- One customer cannot view another customer's order via `/orders/:id` (returns not-found, not a 403 that would confirm the order exists).
- `docker compose up -d --wait` stays fully green with the storefront serving real pages (not just `/health`) through the reverse proxy at `http://localhost:8080/`.

## Open Questions

None.
