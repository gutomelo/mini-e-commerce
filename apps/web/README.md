# web — Loja em Next.js

🇧🇷 [Português (Brasil)](#português-brasil) · 🇺🇸 [English (US)](#english-us)

---

## Português (Brasil)

A loja voltada para o cliente: registro/login, catálogo de produtos com busca e filtros de categoria, um carrinho client-side, checkout, e histórico de pedidos. Next.js 16 App Router, Server Components por padrão. Fala apenas com a API NestJS (`apps/api`) — nunca diretamente com Postgres/Redis ou os serviços Go/Spring Boot.

### Rodando localmente

```bash
docker compose up -d --wait postgres redis api   # a partir da raiz do repositório
pnpm turbo run dev --filter=web                  # http://localhost:3000
```

### Páginas

- `/` — redireciona para `/products`.
- `/register`, `/login` — Server Actions chamam os endpoints de autenticação da API e definem cookies de sessão httpOnly; o registro loga o usuário automaticamente em caso de sucesso.
- `/products` — listagem do catálogo; `page`/`limit`/`search`/`category` são query params na URL (com favoritos possíveis, sem exigir JS no cliente para filtrar).
- `/products/[slug]` — detalhe do produto, com um controle "Adicionar ao carrinho".
- `/cart` — lê o cookie `cart` client-side, rebusca dados atuais do produto (preço/disponibilidade) para cada item de linha, e permite ajustar quantidade ou remover itens.
- `/checkout` — exige autenticação; resume o carrinho e finaliza o pedido. A API reprecifica cada item a partir do registro atual do produto e rejeita o pedido inteiro se algo estiver faltando ou desativado — a loja nunca confia no conteúdo do cookie do carrinho além de `{ productId, quantity }`.
- `/checkout/confirmation/[id]` — exibida logo após um checkout bem-sucedido.
- `/orders`, `/orders/[id]` — histórico de pedidos; ambas exigem autenticação e são restritas server-side ao usuário autenticado (o id de pedido de outro cliente retorna 404).

### Gerenciamento de sessão

Access/refresh tokens vivem em cookies httpOnly, seguros (em produção), `SameSite=Lax` (`apps/web/src/lib/session.ts`), nunca expostos ao JavaScript do cliente. Toda chamada autenticada à API passa pelo `authFetch` de `apps/web/src/data-access/http-client.ts`, que anexa o bearer token e, em um `401`, tenta exatamente um refresh-e-retry silencioso antes de limpar a sessão e expor a falha para quem chamou (as páginas decidem se redirecionam para `/login`).

O cookie `cart` é separado, não httpOnly, e guarda apenas pares `{ productId, quantity }` — sem preços. Mutações do carrinho escrevem diretamente em `document.cookie` a partir de Client Components (`apps/web/src/lib/cart.ts`); não há round trip com o servidor para uma mudança de quantidade, já que nada sensível à segurança vive no cookie e o checkout sempre reprecifica a partir da API independente do seu conteúdo.

### Variáveis de ambiente

- `PORT` — porta HTTP (padrão `3000`).
- `API_BASE_URL` — URL base da API NestJS que essa aplicação chama server-side (padrão do compose `http://api:3001`, padrão de dev local `http://localhost:3001`). Nunca exposta ao navegador — toda chamada à API acontece em Server Components/Actions.

### Testes

```bash
pnpm --filter web test         # testes unitários Vitest (lógica de refresh do http-client em data-access)
pnpm --filter web test:e2e     # suite e2e Playwright — veja apps/web/e2e/support/test-env.ts
```

A suite e2e sobe sua própria instância da API NestJS e servidor de dev do Next.js, apontados para um banco `mini_ecommerce_test` dedicado (compartilhado com a própria suite e2e do `apps/api`) e um índice de banco lógico isolado no Redis, resetados e ressemeados antes de cada execução para que reexecuções sejam idempotentes.

### Docker

Construído a partir da raiz do repositório: `docker compose build web`. Servido atrás do proxy reverso em `http://localhost:8080/`.

---

## English (US)

The customer-facing store: registration/login, product catalog with search and category filters, a client-side cart, checkout, and order history. Next.js 16 App Router, Server Components by default. Talks only to the NestJS API (`apps/api`) — never to Postgres/Redis or the Go/Spring Boot services directly.

### Run locally

```bash
docker compose up -d --wait postgres redis api   # from the repo root
pnpm turbo run dev --filter=web                  # http://localhost:3000
```

### Pages

- `/` — redirects to `/products`.
- `/register`, `/login` — Server Actions call the API's auth endpoints and set httpOnly session cookies; register auto-logs the user in on success.
- `/products` — catalog listing; `page`/`limit`/`search`/`category` are URL query params (bookmarkable, no client JS required to filter).
- `/products/[slug]` — product detail, with an "Add to cart" control.
- `/cart` — reads the client-side `cart` cookie, re-fetches live product data (price/availability) for each line item, and lets you adjust quantity or remove items.
- `/checkout` — requires authentication; summarizes the cart and places the order. The API re-prices every item from the current product record and rejects the whole order if anything is missing or deactivated — the storefront never trusts the cart cookie's contents beyond `{ productId, quantity }`.
- `/checkout/confirmation/[id]` — shown right after a successful checkout.
- `/orders`, `/orders/[id]` — order history; both auth-required and scoped server-side to the authenticated user (another customer's order id 404s).

### Session handling

Access/refresh tokens live in httpOnly, secure (in production), `SameSite=Lax` cookies (`apps/web/src/lib/session.ts`), never exposed to client-side JavaScript. Every authenticated API call goes through `apps/web/src/data-access/http-client.ts`'s `authFetch`, which attaches the bearer token and, on a `401`, attempts exactly one silent refresh-and-retry before clearing the session and surfacing the failure to the caller (pages decide whether to redirect to `/login`).

The `cart` cookie is separate, not httpOnly, and holds only `{ productId, quantity }` pairs — no prices. Cart mutations write directly to `document.cookie` from Client Components (`apps/web/src/lib/cart.ts`); there is no server round trip for a quantity change, since nothing security-sensitive lives in the cookie and checkout always re-prices from the API regardless of its contents.

### Environment variables

- `PORT` — HTTP port (default `3000`).
- `API_BASE_URL` — base URL of the NestJS API this app calls server-side (compose default `http://api:3001`, local dev default `http://localhost:3001`). Never exposed to the browser — every API call happens in Server Components/Actions.

### Testing

```bash
pnpm --filter web test         # Vitest unit tests (data-access http-client refresh logic)
pnpm --filter web test:e2e     # Playwright e2e suite — see apps/web/e2e/support/test-env.ts
```

The e2e suite starts its own NestJS API instance and Next.js dev server, pointed at a dedicated `mini_ecommerce_test` database (shared with `apps/api`'s own e2e suite) and an isolated Redis logical DB index, reset and reseeded before every run so reruns are idempotent.

### Docker

Built from the repo root: `docker compose build web`. Served behind the reverse proxy at `http://localhost:8080/`.
