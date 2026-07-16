# Suite de testes e2e

🇧🇷 [Português (Brasil)](#português-brasil) · 🇺🇸 [English (US)](#english-us)

---

## Português (Brasil)

Roda com `pnpm --filter api run test:e2e` (Jest, config: `test/jest-e2e.json`).

### Estratégia do banco de teste

A suite roda contra um **banco dedicado**, `mini_ecommerce_test`, na mesma instância do Postgres que o compose já expõe em `localhost:5433` (`docker compose up -d --wait postgres redis`) — nunca contra o banco de desenvolvimento `mini_ecommerce`. Isso mantém a suite livre para truncar e ressemear sem perturbar dados que um desenvolvedor possa estar inspecionando via `docker compose up`, e mantém cada execução reproduzível byte a byte.

O Redis é compartilhado com o dev em `localhost:6380`, mas a suite usa o **índice de banco lógico 1** (`redis://localhost:6380/1`) para que suas chaves nunca colidam com o que um desenvolvedor tenha em cache no índice 0 enquanto mexe na API localmente.

#### Por que não um arquivo `.env.test`

O hook de proteção de segredos do repositório bloqueia o agente de criar ou editar qualquer arquivo `.env*` (só `.env.example` é permitido). De qualquer forma não há nada secreto na configuração de teste — credenciais fixas, somente locais — então ela vive em um módulo TypeScript comum: `test/support/test-env.ts`.

#### Sequência de bootstrap

1. **`test/setup-env.ts`** (`setupFiles` do Jest, roda em todo worker antes do framework de teste e de qualquer arquivo/módulo de teste ser avaliado): chama `applyTestEnv()`, que define `DATABASE_URL`, `REDIS_URL`, e as variáveis de JWT/admin em `process.env` _antes_ de `PrismaService`, `RedisCacheAdapter`, ou `JwtTokenService` as lerem no momento da construção.
2. **`test/global-setup.ts`** (`globalSetup` do Jest, roda uma única vez antes de qualquer worker iniciar):
   - cria `mini_ecommerce_test` se ainda não existir (via um cliente `pg` contra o banco de manutenção `postgres`);
   - aplica as migrações com `prisma migrate deploy` (o mesmo comando que o container `api` do compose roda ao iniciar, conforme a lista de verificação de `docs/phases/phase-02-api-core.md`);
   - trunca toda tabela (`RESTART IDENTITY CASCADE`);
   - ressemeia através do script `prisma/seed.ts` já existente (usuário admin + o catálogo de demonstração com 3 categorias / 12 produtos), apontado para o banco de teste.

Truncar + ressemear no início de cada execução (em vez de depender de limpeza por teste) é o que torna `pnpm --filter api run test:e2e` **idempotente entre reexecuções**: o que uma execução anterior deixou é apagado antes do primeiro teste da próxima execução rodar.

#### Evitando colisões entre arquivos/execuções

- `test/jest-e2e.json` define `"testTimeout": 30000`; o script `test:e2e` do `package.json` passa `--runInBand` para que as specs rodem sequencialmente em um único processo. Isso mantém o bucket de rate-limit do teste de throttling (em memória, restrito à sua própria instância de `INestApplication`) isolado das chamadas de login de qualquer outra spec, e evita que o estado compartilhado do Postgres/Redis tenha condição de corrida entre workers paralelos.
- Toda spec que cria dados usa um sufixo aleatório (`test/support/fixtures.ts#uniqueSuffix`) para emails/slugs, para que reexecuções dentro da mesma execução geral de testes (ou sobreposição acidental) nunca colidam com uma restrição de unicidade.
- Specs que precisam de asserções de paginação/filtro contra dados **conhecidos** (`products.e2e-spec.ts`) dependem das 3 categorias / 12 produtos fixos do catálogo semeado. Toda outra spec que precisa escrever uma categoria/produto cria sua **própria** categoria dedicada primeiro (veja `rbac.e2e-spec.ts`, `cache.e2e-spec.ts`) em vez de escrever em `electronics`/`apparel`/`home-kitchen`, para que as contagens de paginação nunca variem conforme a ordem de execução dos arquivos.

### Cobertura (critérios de aceitação da spec)

| Área                                                                                                                                                                                                                                                                                                                                             | Arquivo                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| Registro → login → rota protegida → rotação de refresh → token reutilizado rejeitado → logout revoga                                                                                                                                                                                                                                             | `auth.e2e-spec.ts`       |
| RBAC: CUSTOMER bloqueado (403) / ADMIN permitido (201) em escritas de produtos e categorias                                                                                                                                                                                                                                                      | `rbac.e2e-spec.ts`       |
| Paginação (`page`/`limit`/`meta`), filtros (`search`/`category`/`minPrice`/`maxPrice`), ordenação (`sort`)                                                                                                                                                                                                                                       | `products.e2e-spec.ts`   |
| Cache hit (leitura repetida servida de forma consistente, verificada diretamente contra o Redis para categorias) + invalidação na escrita (categorias e produtos)                                                                                                                                                                                | `cache.e2e-spec.ts`      |
| Throttling: 429 após o bucket de 10 req/min do `auth` em `/auth/login`                                                                                                                                                                                                                                                                           | `throttling.e2e-spec.ts` |
| Health check                                                                                                                                                                                                                                                                                                                                     | `app.e2e-spec.ts`        |
| Integração orientada a eventos: publicação de `order.created` (um evento, `correlationId`/`totalCents`/`items` corretos) + consumo de `payment.completed`/`payment.failed` via `/events/qstash` (transições de status, reentrega idempotente, 401 de assinatura inválida, 400 de evento não suportado)                                           | `events.e2e-spec.ts`     |
| Painel admin: `GET /admin/orders` (+ `:id`) visibilidade entre clientes, filtro de status (válido/inválido), 401/403/404 — e `GET`/`PATCH /admin/inventory/:productId` contra um `FakeInventoryClient` (quantidade semeada, atualização, quantidade negativa 400, id malformado 400, id não semeado 404), todos com verificações de RBAC 401/403 | `admin.e2e-spec.ts`      |

### Arquivos de apoio

- `test/support/test-env.ts` — as constantes do ambiente de teste + `applyTestEnv()`.
- `test/support/test-app.ts` — `createTestApp()` sobe uma aplicação Nest completa espelhando `src/main.ts` exatamente (versionamento por URI, prefixo global, `ValidationPipe`, middleware de correlation id, logger pino); `api()` é um atalho do `supertest`; `bodyOf<T>()` converte o corpo de uma resposta para o tipo esperado do envelope. `createTestApp({ fakeInventoryClient })` aceita uma instância opcional de `FakeInventoryClient` e sobrescreve o provider real de `InventoryClient` com ela — necessário para qualquer spec que exercite `/admin/inventory/:productId`, já que o `apps/inventory` não tem porta do host publicada e é inalcançável a partir do processo Jest rodando no host. Omitir a opção deixa toda outra spec com a app conectada ao provider real, sem alteração.
- `test/support/response-types.ts` — formatos de envelope tipados reutilizados entre specs (reutiliza os tipos reais `ProductOutput`/`CategoryOutput`/`ProfileOutput` de `src/`, para que as asserções permaneçam fiéis ao formato real da API).
- `test/support/fixtures.ts` — `registerAndLoginCustomer()`, `loginAsAdmin()` (credenciais de admin semeadas), `uniqueSuffix()`.
- `test/support/qstash-signing.ts` — `signQStashRequest()` monta um JWT `Upstash-Signature` (chave de assinatura atual + URL de destino fixadas em `test-env.ts`) que reproduz exatamente as claims que o assinador real da Upstash produz, para que `events.e2e-spec.ts` possa assinar manualmente payloads de webhook `payment.completed`/`payment.failed` e ter o `QStashSignatureVerifier` da aplicação em execução aceitando-os sem nenhuma dependência real da Upstash.
- `src/infrastructure/inventory/fake-inventory-client.ts` — `FakeInventoryClient`, um dublê de teste em memória para `InventoryClient` (espelha o padrão do `FakeEventPublisher`). `seed(productId, quantity)` pré-carrega uma linha de estoque conhecida; `getStock` retorna `null` para um id não semeado, batendo com o contrato de 404-como-null do `HttpInventoryClient` real; `setStock` faz upsert. Usado por `admin.e2e-spec.ts` através de `createTestApp({ fakeInventoryClient })`.

### Rodando localmente

```bash
docker compose up -d --wait postgres redis
pnpm --filter api run test:e2e
```

Nenhum passo manual de migração é necessário — `test/global-setup.ts` cuida disso.

---

## English (US)

Runs with `pnpm --filter api run test:e2e` (Jest, config: `test/jest-e2e.json`).

### Test database strategy

The suite runs against a **dedicated database**, `mini_ecommerce_test`, on the
same Postgres instance the compose stack already exposes at
`localhost:5433` (`docker compose up -d --wait postgres redis`) — never
against the dev `mini_ecommerce` database. This keeps the suite free to
truncate and reseed without disturbing data a developer might be inspecting
via `docker compose up`, and keeps every run byte-for-byte reproducible.

Redis is shared with dev at `localhost:6380`, but the suite uses **logical DB
index 1** (`redis://localhost:6380/1`) so its keys never collide with
whatever a developer has cached on index 0 while poking at the API locally.

#### Why not a `.env.test` file

The repo's secrets-protection hook blocks the agent from creating or editing
any `.env*` file (only `.env.example` is allowed). There is nothing secret in
the test configuration anyway — fixed, local-only credentials — so it lives
in a plain TypeScript module instead: `test/support/test-env.ts`.

#### Bootstrap sequence

1. **`test/setup-env.ts`** (Jest `setupFiles`, runs in every worker before the
   test framework and any test file/module is evaluated): calls
   `applyTestEnv()`, which sets `DATABASE_URL`, `REDIS_URL`, and the JWT/admin
   env vars on `process.env` _before_ `PrismaService`, `RedisCacheAdapter`, or
   `JwtTokenService` read them at construction time.
2. **`test/global-setup.ts`** (Jest `globalSetup`, runs once before any
   worker starts):
   - creates `mini_ecommerce_test` if it doesn't exist yet (via a `pg` client
     against the `postgres` maintenance database);
   - applies migrations with `prisma migrate deploy` (same command
     `docker compose`'s api container runs on start, per
     `docs/phases/phase-02-api-core.md`'s verification list);
   - truncates every table (`RESTART IDENTITY CASCADE`);
   - reseeds via the existing `prisma/seed.ts` script (admin user + the 3
     categories / 12 products demo catalog), pointed at the test database.

Truncating + reseeding at the start of every run (rather than relying on
per-test cleanup) is what makes `pnpm --filter api run test:e2e` **idempotent
across reruns**: whatever a previous run left behind is wiped before the next
run's first test executes.

#### Avoiding cross-file/cross-run collisions

- `test/jest-e2e.json` sets `"testTimeout": 30000`; `package.json`'s
  `test:e2e` script passes `--runInBand` so specs run sequentially in one
  process. This keeps the throttling test's rate-limit bucket (in-memory,
  scoped to its own `INestApplication` instance) isolated from every other
  spec's login calls, and avoids the shared Postgres/Redis state racing
  across parallel workers.
- Every spec that creates data uses a random suffix
  (`test/support/fixtures.ts#uniqueSuffix`) for emails/slugs, so reruns
  within the same overall test run (or accidental overlap) never hit a
  unique-constraint conflict.
- Specs that need pagination/filtering assertions against **known** data
  (`products.e2e-spec.ts`) rely on the seeded catalog's fixed 3
  categories / 12 products. Every other spec that needs to write a
  category/product creates its **own** dedicated category first (see
  `rbac.e2e-spec.ts`, `cache.e2e-spec.ts`) instead of writing into
  `electronics`/`apparel`/`home-kitchen`, so the pagination counts never
  drift based on file execution order.

### Coverage (spec acceptance criteria)

| Area                                                                                                                                                                                                                                                                                                               | File                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| Register → login → protected route → refresh rotation → reused token rejected → logout revokes                                                                                                                                                                                                                     | `auth.e2e-spec.ts`       |
| RBAC: CUSTOMER blocked (403) / ADMIN allowed (201) on product & category writes                                                                                                                                                                                                                                    | `rbac.e2e-spec.ts`       |
| Pagination (`page`/`limit`/`meta`), filtering (`search`/`category`/`minPrice`/`maxPrice`), sorting (`sort`)                                                                                                                                                                                                        | `products.e2e-spec.ts`   |
| Cache hit (repeated read served consistently, verified directly against Redis for categories) + invalidation on write (categories and products)                                                                                                                                                                    | `cache.e2e-spec.ts`      |
| Throttling: 429 after the 10 req/min `auth` bucket on `/auth/login`                                                                                                                                                                                                                                                | `throttling.e2e-spec.ts` |
| Health check                                                                                                                                                                                                                                                                                                       | `app.e2e-spec.ts`        |
| Event-driven integration: `order.created` publish (one event, correct `correlationId`/`totalCents`/`items`) + `payment.completed`/`payment.failed` consumption via `/events/qstash` (status transitions, idempotent redelivery, invalid-signature 401, unsupported-event 400)                                      | `events.e2e-spec.ts`     |
| Admin panel: `GET /admin/orders` (+ `:id`) cross-customer visibility, status filter (valid/invalid), 401/403/404 — and `GET`/`PATCH /admin/inventory/:productId` against a `FakeInventoryClient` (seeded quantity, update, negative-quantity 400, malformed-id 400, unseeded-id 404), all with 401/403 RBAC checks | `admin.e2e-spec.ts`      |

### Support files

- `test/support/test-env.ts` — the test environment constants + `applyTestEnv()`.
- `test/support/test-app.ts` — `createTestApp()` boots a full Nest app
  mirroring `src/main.ts` exactly (URI versioning, global prefix,
  `ValidationPipe`, correlation-id middleware, pino logger); `api()` is a
  `supertest` shorthand; `bodyOf<T>()` casts a response body to its expected
  envelope type. `createTestApp({ fakeInventoryClient })` accepts an optional
  `FakeInventoryClient` instance and overrides the real `InventoryClient`
  provider with it — needed by any spec that exercises
  `/admin/inventory/:productId`, since `apps/inventory` has no host port
  published and is unreachable from the host-side Jest process. Omitting the
  option leaves every other spec's app wired to the real provider unchanged.
- `test/support/response-types.ts` — typed envelope shapes reused across
  specs (reuses the real `ProductOutput`/`CategoryOutput`/`ProfileOutput`
  types from `src/`, so assertions stay honest about the actual API shape).
- `test/support/fixtures.ts` — `registerAndLoginCustomer()`,
  `loginAsAdmin()` (seeded admin credentials), `uniqueSuffix()`.
- `test/support/qstash-signing.ts` — `signQStashRequest()` builds an
  `Upstash-Signature` JWT (current signing key + destination URL fixed by
  `test-env.ts`) that reproduces the exact claims Upstash's real signer
  produces, so `events.e2e-spec.ts` can hand-sign `payment.completed`/
  `payment.failed` webhook payloads and have the running app's
  `QStashSignatureVerifier` accept them without any live Upstash dependency.
- `src/infrastructure/inventory/fake-inventory-client.ts` — `FakeInventoryClient`,
  an in-memory `InventoryClient` test double (mirrors the
  `FakeEventPublisher` pattern). `seed(productId, quantity)` preloads a known
  stock row; `getStock` returns `null` for an unseeded id, matching the real
  `HttpInventoryClient`'s 404-as-null contract; `setStock` upserts. Used by
  `admin.e2e-spec.ts` via `createTestApp({ fakeInventoryClient })`.

### Running locally

```bash
docker compose up -d --wait postgres redis
pnpm --filter api run test:e2e
```

No manual migration step is required — `test/global-setup.ts` handles it.
