# api — API Gateway / BFF em NestJS

🇧🇷 [Português (Brasil)](#português-brasil) · 🇺🇸 [English (US)](#english-us)

---

## Português (Brasil)

O único backend consumido pelos frontends. Implementa camadas de Clean Architecture (`domain/`, `application/`, `infrastructure/`, `presentation/`), autenticação JWT com rotação de refresh tokens, RBAC, um catálogo de produtos/categorias com cache, criação de pedidos, e integração de eventos via QStash. Prefixo global: `/api`; rotas versionadas ficam em `/api/v1`.

### Rodando localmente

```bash
docker compose up -d --wait postgres redis   # a partir da raiz do repositório
pnpm turbo run dev --filter=api              # http://localhost:3001/api
```

O `prisma generate` roda automaticamente antes de `dev`/`build`. As migrações não são aplicadas automaticamente fora do container — rode-as você mesmo contra o Postgres do compose (veja o fluxo do Prisma abaixo).

### Health

`GET /api/health` → `{"status":"ok","service":"api"}` (sem versionamento, fora do versionamento por URI e excluído do Swagger).

### Documentação da API

Swagger UI: `http://localhost:3001/api/docs` (ou `http://localhost:8080/api/docs` através do proxy reverso do compose). A autenticação Bearer já está configurada — cole um access token para testar rotas protegidas.

### Endpoints (`/api/v1`)

- `POST /auth/register` — público. Registra uma conta `CUSTOMER`.
- `POST /auth/login` — público. Retorna `{ accessToken, refreshToken }`.
- `POST /auth/refresh` — público. Rotaciona um refresh token: o token apresentado é revogado e um novo par é emitido. Um refresh token reutilizado ou revogado é rejeitado com `401`.
- `POST /auth/logout` — autenticado. Revoga o refresh token apresentado.
- `GET /users/me` — autenticado. Retorna o perfil de quem chamou.
- `GET /categories` — público, com cache (`categories:list`, TTL de 5 min).
- `POST /categories` / `PATCH /categories/:id` / `DELETE /categories/:id` — somente `ADMIN`. Escritas invalidam o cache de categorias; apagar uma categoria que ainda tem produtos falha com `409`.
- `GET /products?page=&limit=&search=&category=&minPrice=&maxPrice=&sort=` — público, com cache por query normalizada (`products:list:*`). `minPrice`/`maxPrice` são inteiros em centavos; `sort` é `<campo>:<direção>` (`createdAt`, `price`; `asc`, `desc`; padrão `createdAt:desc`).
- `GET /products/:idOrSlug` — público, com cache (`products:id:<id>` / `products:slug:<slug>`).
- `POST /products` / `PATCH /products/:id` / `DELETE /products/:id` — somente `ADMIN`. `DELETE` é um soft delete (`isActive = false`); produtos com soft-delete retornam `404` em qualquer lugar. Escritas invalidam as chaves de detalhe afetadas mais todo o prefixo `products:list:*`.
- `POST /orders` — autenticado. Reprecifica cada item a partir do registro atual de `Product` (nunca confia em um preço enviado pelo cliente); publica `order.created` após persistir (veja "Integração orientada a eventos" abaixo).
- `GET /orders` — autenticado. Paginado, mais recentes primeiro, restrito a quem chamou.
- `GET /orders/:id` — autenticado. `404` se o pedido não existir ou pertencer a outro usuário.

As rotas de autenticação compartilham um bucket de throttle mais restrito (10 req/min); todas as outras rotas usam o bucket padrão (100 req/min).

### Integração orientada a eventos

- **Publica** `order.created` (correlation id = o próprio `id` do novo pedido, para rastreabilidade ponta a ponta entre serviços) depois que um pedido é persistido, através de uma porta `EventPublisher`: `{ orderId, totalCents, items: [{ productId, quantity }] }` — um payload superset que tanto o `apps/inventory` (`items`) quanto o `apps/payment` (`totalCents`) já consomem sem alterações. Duas implementações: `FakeEventPublisher` (gravador em memória, o padrão ativo para que `/verify-phase` e o desenvolvimento local nunca dependam de um round-trip real com o Upstash) e `QStashEventPublisher` (o adapter real, que distribui o envelope para `QSTASH_DESTINATION_URL` e `PAYMENT_QSTASH_DESTINATION_URL` como duas chamadas independentes e best-effort). Uma falha ao publicar é logada, nunca relançada — o pedido não é afetado.
- **Consome** `payment.completed`/`payment.failed`: `POST /events/qstash` verifica o header `Upstash-Signature` (via `Receiver` do `@upstash/qstash`, checando tanto a assinatura sobre o corpo bruto da requisição quanto, quando `API_QSTASH_DESTINATION_URL` está definido, a claim de URL de destino da requisição assinada) antes de o corpo ser processado. Rejeita (`400`) qualquer `event` diferente de `payment.completed`/`payment.failed`. Idempotente: uma tabela `ProcessedEvent` reivindica `(correlationId, event)` via um único `INSERT ... ON CONFLICT DO NOTHING` atômico — uma reentrega é um no-op silencioso, não uma mudança de status duplicada. Em `payment.completed` o status do pedido referenciado vira `PAID`; em `payment.failed`, `PAYMENT_FAILED`. Um `orderId` desconhecido é logado e confirmado (não lançado como erro), já que o QStash tentaria de novo para sempre um payload que nunca conseguiria processar com sucesso. Sem `JwtAuthGuard` nessa rota — o QStash se autentica via `Upstash-Signature`, não uma sessão de usuário.
- `inventory.updated` não tem consumidor no `apps/api` — o decremento de estoque do inventory é fire-and-forget e não tem efeito no status do pedido.
- `EVENT_PUBLISHER_MODE` (padrão `fake` / `real`) seleciona `FakeEventPublisher` vs. `QStashEventPublisher` na inicialização — veja Variáveis de ambiente abaixo. Toda verificação automatizada roda com `fake`; mude para `real` só com credenciais `QSTASH_*` genuínas configuradas (veja [docs/manual-verification/real-event-flow.md](../../docs/manual-verification/real-event-flow.md)).

### Endpoints de admin (somente papel `ADMIN`)

- `GET /admin/orders?page=&limit=&status=` / `GET /admin/orders/:id` — revisão de pedidos entre clientes (somente leitura; o status continua controlado exclusivamente pelo fluxo orientado a eventos acima).
- `GET`/`PATCH /admin/inventory/:productId` — repassa para os endpoints internos de estoque do `apps/inventory` via `HttpInventoryClient`, autenticado com `INVENTORY_INTERNAL_API_KEY`. Encaminha o próprio correlation id de quem chamou como `X-Correlation-Id` na chamada de saída.

### Envelopes de resposta

- Lista: `{ data: T[], meta: { page, limit, total, totalPages } }`
- Único: `{ data: T }`
- Erro: `{ statusCode, error, message, correlationId, timestamp, path }` — nunca inclui stack trace; toda requisição/resposta é logada como JSON estruturado carregando o mesmo `correlationId` (aceita um header `x-correlation-id` de entrada ou gera um).

### Variáveis de ambiente

Veja o `.env.example` na raiz para os valores padrão. O compose fornece valores locais seguros automaticamente.

- `PORT` — porta HTTP (padrão `3001`).
- `DATABASE_URL` — string de conexão do Postgres (padrão do compose aponta para `localhost:5433` a partir do host, `postgres:5432` dentro do container).
- `REDIS_URL` — string de conexão do Redis (padrão do compose `localhost:6380` a partir do host, `redis:6379` dentro do container; falhas de cache degradam graciosamente e nunca quebram uma requisição).
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — segredos de assinatura distintos para access e refresh tokens.
- `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` — tempos de vida dos tokens (padrão `15m` / `7d`).
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — credenciais da conta admin criada pelo script de seed.
- `QSTASH_TOKEN` — token de portador para o `QStashEventPublisher` real.
- `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` — verificam as assinaturas de webhook de entrada `payment.completed`/`payment.failed` (ambas aceitas, já que o QStash rotaciona as chaves; mesma conta Upstash do `apps/inventory`/`apps/payment`).
- `QSTASH_DESTINATION_URL` / `PAYMENT_QSTASH_DESTINATION_URL` — URLs dos próprios webhooks do inventory/payment, usadas pelo adapter real `QStashEventPublisher` para distribuir `order.created` para ambos.
- `API_QSTASH_DESTINATION_URL` — a URL externa para a qual o QStash foi configurado a entregar o próprio webhook do `apps/api`; precisa bater exatamente com o que o QStash assinou.
- `EVENT_PUBLISHER_MODE` — `fake` (padrão) conecta o `FakeEventPublisher`, usado por toda verificação automatizada; `real` conecta o `QStashEventPublisher`. Qualquer valor diferente de exatamente `real` cai de volta para `fake`.
- `CORS_ORIGINS` — lista de origens permitidas separadas por vírgula para quem chama pelo navegador (só é exercitado pelo `ng serve`/`next dev` local; vazio/não definido desabilita o CORS em vez de permitir qualquer origem).
- `INVENTORY_BASE_URL` / `INVENTORY_INTERNAL_API_KEY` — URL base e segredo compartilhado usados para chamar os endpoints internos de estoque do `apps/inventory` a partir do proxy de admin acima.

### Fluxo do Prisma

```bash
# aplica as migrações contra o Postgres do compose (a partir de apps/api)
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/mini_ecommerce pnpm exec prisma migrate deploy

# semeia o usuário admin + catálogo de demonstração (idempotente, seguro para rodar de novo)
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/mini_ecommerce pnpm exec tsx prisma/seed.ts
```

A imagem Docker do `api` roda ambos os passos automaticamente ao iniciar o container (veja `docker-entrypoint.sh`).

### Testes

```bash
pnpm --filter api test        # testes unitários (use cases, adapters — ports mockados, sem infra real)
pnpm --filter api test:e2e    # suite e2e — veja apps/api/test/README.md para a estratégia do banco de teste
```

A suite e2e roda contra um banco `mini_ecommerce_test` dedicado e um banco lógico isolado do Redis (ambos nos mesmos serviços do compose), resetados e ressemeados automaticamente antes de cada execução.

### Docker

Construído a partir da raiz do repositório: `docker compose build api`. Acessível através do proxy reverso em `http://localhost:8080/api/`.

---

## English (US)

The only backend consumed by the frontends. Implements Clean Architecture layering (`domain/`, `application/`, `infrastructure/`, `presentation/`), JWT authentication with rotated refresh tokens, RBAC, a cached product/category catalog, order placement, and QStash-based event integration. Global prefix: `/api`; versioned routes live under `/api/v1`.

### Run locally

```bash
docker compose up -d --wait postgres redis   # from the repo root
pnpm turbo run dev --filter=api              # http://localhost:3001/api
```

`prisma generate` runs automatically before `dev`/`build`. Migrations are not applied automatically outside the container — run them yourself against the compose Postgres (see Prisma workflow below).

### Health

`GET /api/health` → `{"status":"ok","service":"api"}` (unversioned, outside URI versioning and excluded from Swagger).

### API documentation

Swagger UI: `http://localhost:3001/api/docs` (or `http://localhost:8080/api/docs` through the compose reverse proxy). Bearer auth is pre-wired — paste an access token to try protected routes.

### Endpoints (`/api/v1`)

- `POST /auth/register` — public. Registers a `CUSTOMER` account.
- `POST /auth/login` — public. Returns `{ accessToken, refreshToken }`.
- `POST /auth/refresh` — public. Rotates a refresh token: the presented token is revoked and a new pair is issued. A reused or revoked refresh token is rejected with `401`.
- `POST /auth/logout` — authenticated. Revokes the presented refresh token.
- `GET /users/me` — authenticated. Returns the caller's profile.
- `GET /categories` — public, cached (`categories:list`, 5 min TTL).
- `POST /categories` / `PATCH /categories/:id` / `DELETE /categories/:id` — `ADMIN` only. Writes invalidate the category cache; deleting a category that still has products fails with `409`.
- `GET /products?page=&limit=&search=&category=&minPrice=&maxPrice=&sort=` — public, cached per normalized query (`products:list:*`). `minPrice`/`maxPrice` are integer cents; `sort` is `<field>:<direction>` (`createdAt`, `price`; `asc`, `desc`; default `createdAt:desc`).
- `GET /products/:idOrSlug` — public, cached (`products:id:<id>` / `products:slug:<slug>`).
- `POST /products` / `PATCH /products/:id` / `DELETE /products/:id` — `ADMIN` only. `DELETE` is a soft delete (`isActive = false`); soft-deleted products are `404` everywhere. Writes invalidate the affected detail keys plus the whole `products:list:*` prefix.
- `POST /orders` — authenticated. Re-prices every line item from the current `Product` record (never trusts a client-supplied price); publishes `order.created` after persisting (see "Event-driven integration" below).
- `GET /orders` — authenticated. Paginated, newest-first, scoped to the caller.
- `GET /orders/:id` — authenticated. `404` if the order doesn't exist or belongs to a different user.

Auth routes share a stricter throttle bucket (10 req/min); every other route uses the default bucket (100 req/min).

### Event-driven integration

- **Publishes** `order.created` (correlation id = the new order's own `id`, for end-to-end traceability across services) after an order is persisted, through an `EventPublisher` port: `{ orderId, totalCents, items: [{ productId, quantity }] }` — a superset payload both `apps/inventory` (`items`) and `apps/payment` (`totalCents`) already consume unmodified. Two implementations: `FakeEventPublisher` (in-memory recorder, the active default so `/verify-phase` and local dev never depend on a live Upstash round-trip) and `QStashEventPublisher` (the real adapter, built but not yet wired as the active provider — fans the envelope out to `QSTASH_DESTINATION_URL` and `PAYMENT_QSTASH_DESTINATION_URL` as two independent, best-effort calls). A publish failure is logged, never rethrown — the order is unaffected.
- **Consumes** `payment.completed`/`payment.failed`: `POST /events/qstash` verifies the `Upstash-Signature` header (via `@upstash/qstash`'s `Receiver`, checking both the signature over the raw request body and, when `API_QSTASH_DESTINATION_URL` is set, the signed request's destination-URL claim) before the body is ever processed. Rejects (`400`) any `event` other than `payment.completed`/`payment.failed`. Idempotent: a `ProcessedEvent` table claims `(correlationId, event)` via a single atomic `INSERT ... ON CONFLICT DO NOTHING` — a redelivery is a silent no-op, not a duplicate status change. On `payment.completed` the referenced order's status becomes `PAID`; on `payment.failed`, `PAYMENT_FAILED`. An unknown `orderId` is logged and acknowledged (not thrown), since QStash would otherwise retry forever for a payload it can never successfully process. No `JwtAuthGuard` on this route — QStash authenticates via `Upstash-Signature`, not a user session.
- `inventory.updated` has no consumer in `apps/api` — inventory's stock decrement is fire-and-forget and has no bearing on order status.
- `EVENT_PUBLISHER_MODE` (`fake` default / `real`) selects `FakeEventPublisher` vs. `QStashEventPublisher` at startup — see Environment variables below. Every automated check runs with `fake`; flip to `real` only with genuine `QSTASH_*` credentials configured (see [docs/manual-verification/real-event-flow.md](../../docs/manual-verification/real-event-flow.md)).

### Admin endpoints (`ADMIN` role only)

- `GET /admin/orders?page=&limit=&status=` / `GET /admin/orders/:id` — cross-customer order review (view-only; status stays controlled exclusively by the event-driven flow above).
- `GET`/`PATCH /admin/inventory/:productId` — proxies to `apps/inventory`'s internal stock endpoints via `HttpInventoryClient`, authenticated with `INVENTORY_INTERNAL_API_KEY`. Forwards the caller's own correlation id as `X-Correlation-Id` on the outbound call.

### Response envelopes

- List: `{ data: T[], meta: { page, limit, total, totalPages } }`
- Single: `{ data: T }`
- Error: `{ statusCode, error, message, correlationId, timestamp, path }` — never includes a stack trace; every request/response is logged as structured JSON carrying the same `correlationId` (accepts an inbound `x-correlation-id` header or generates one).

### Environment variables

See the root `.env.example` for defaults. Compose provides safe local values automatically.

- `PORT` — HTTP port (default `3001`).
- `DATABASE_URL` — Postgres connection string (compose default targets `localhost:5433` from the host, `postgres:5432` in-container).
- `REDIS_URL` — Redis connection string (compose default `localhost:6380` from the host, `redis:6379` in-container; cache failures degrade gracefully and never break a request).
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — distinct signing secrets for access and refresh tokens.
- `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` — token lifetimes (default `15m` / `7d`).
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — credentials for the admin account created by the seed script.
- `QSTASH_TOKEN` — bearer token for the real `QStashEventPublisher`.
- `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` — verify inbound `payment.completed`/`payment.failed` webhook signatures (both accepted, since QStash rotates keys; same Upstash account as `apps/inventory`/`apps/payment`).
- `QSTASH_DESTINATION_URL` / `PAYMENT_QSTASH_DESTINATION_URL` — inventory's/payment's own webhook URLs, used by the real `QStashEventPublisher` adapter to fan `order.created` out to both.
- `API_QSTASH_DESTINATION_URL` — the external URL QStash was told to deliver `apps/api`'s own webhook to; must match exactly what QStash signed.
- `EVENT_PUBLISHER_MODE` — `fake` (default) wires `FakeEventPublisher`, used by every automated check; `real` wires `QStashEventPublisher`. Any value other than exactly `real` falls back to `fake`.
- `CORS_ORIGINS` — comma-separated allow-list for browser callers (only exercised by local `ng serve`/`next dev`; empty/unset disables CORS rather than allowing every origin).
- `INVENTORY_BASE_URL` / `INVENTORY_INTERNAL_API_KEY` — base URL and shared secret used to call `apps/inventory`'s internal stock endpoints from the admin proxy above.

### Prisma workflow

```bash
# apply migrations against the compose Postgres (from apps/api)
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/mini_ecommerce pnpm exec prisma migrate deploy

# seed the admin user + demo catalog (idempotent, safe to rerun)
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/mini_ecommerce pnpm exec tsx prisma/seed.ts
```

The `api` Docker image runs both steps automatically on container start (see `docker-entrypoint.sh`).

### Testing

```bash
pnpm --filter api test        # unit tests (use cases, adapters — mocked ports, no real infra)
pnpm --filter api test:e2e    # e2e suite — see apps/api/test/README.md for the test-database strategy
```

The e2e suite runs against a dedicated `mini_ecommerce_test` database and an isolated Redis logical DB (both on the same compose services), reset and reseeded automatically before each run.

### Docker

Built from the repo root: `docker compose build api`. Reached through the reverse proxy at `http://localhost:8080/api/`.
