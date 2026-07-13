# web — Next.js Storefront

The customer-facing store: registration/login, product catalog with search and category filters, a client-side cart, checkout, and order history. Next.js 16 App Router, Server Components by default. Talks only to the NestJS API (`apps/api`) — never to Postgres/Redis or the Go/Spring Boot services directly.

## Run locally

```bash
docker compose up -d --wait postgres redis api   # from the repo root
pnpm turbo run dev --filter=web                  # http://localhost:3000
```

## Pages

- `/` — redirects to `/products`.
- `/register`, `/login` — Server Actions call the API's auth endpoints and set httpOnly session cookies; register auto-logs the user in on success.
- `/products` — catalog listing; `page`/`limit`/`search`/`category` are URL query params (bookmarkable, no client JS required to filter).
- `/products/[slug]` — product detail, with an "Add to cart" control.
- `/cart` — reads the client-side `cart` cookie, re-fetches live product data (price/availability) for each line item, and lets you adjust quantity or remove items.
- `/checkout` — requires authentication; summarizes the cart and places the order. The API re-prices every item from the current product record and rejects the whole order if anything is missing or deactivated — the storefront never trusts the cart cookie's contents beyond `{ productId, quantity }`.
- `/checkout/confirmation/[id]` — shown right after a successful checkout.
- `/orders`, `/orders/[id]` — order history; both auth-required and scoped server-side to the authenticated user (another customer's order id 404s).

## Session handling

Access/refresh tokens live in httpOnly, secure (in production), `SameSite=Lax` cookies (`apps/web/src/lib/session.ts`), never exposed to client-side JavaScript. Every authenticated API call goes through `apps/web/src/data-access/http-client.ts`'s `authFetch`, which attaches the bearer token and, on a `401`, attempts exactly one silent refresh-and-retry before clearing the session and surfacing the failure to the caller (pages decide whether to redirect to `/login`).

The `cart` cookie is separate, not httpOnly, and holds only `{ productId, quantity }` pairs — no prices. Cart mutations write directly to `document.cookie` from Client Components (`apps/web/src/lib/cart.ts`); there is no server round trip for a quantity change, since nothing security-sensitive lives in the cookie and checkout always re-prices from the API regardless of its contents.

## Environment variables

- `PORT` — HTTP port (default `3000`).
- `API_BASE_URL` — base URL of the NestJS API this app calls server-side (compose default `http://api:3001`, local dev default `http://localhost:3001`). Never exposed to the browser — every API call happens in Server Components/Actions.

## Testing

```bash
pnpm --filter web test         # Vitest unit tests (data-access http-client refresh logic)
pnpm --filter web test:e2e     # Playwright e2e suite — see apps/web/e2e/support/test-env.ts
```

The e2e suite starts its own NestJS API instance and Next.js dev server, pointed at a dedicated `mini_ecommerce_test` database (shared with `apps/api`'s own e2e suite) and an isolated Redis logical DB index, reset and reseeded before every run so reruns are idempotent.

## Docker

Built from the repo root: `docker compose build web`. Served behind the reverse proxy at `http://localhost:8080/`.
