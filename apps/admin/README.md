# admin — Painel Administrativo em Angular

🇧🇷 [Português (Brasil)](#português-brasil) · 🇺🇸 [English (US)](#english-us)

---

## Português (Brasil)

Ferramenta interna restrita ao papel `ADMIN`: um dashboard, gestão de produtos/categorias, revisão de pedidos somente leitura, e correção de estoque — tudo apoiado pelo `apps/api`, que por sua vez repassa leituras/escritas de estoque para o `apps/inventory` (essa SPA nunca fala diretamente com Go ou Spring Boot, seguindo a regra de arquitetura orientada a serviços do projeto). Angular 21, componentes standalone, signals, Angular Material. Servido como um build estático sob `/admin/` atrás do proxy reverso.

> O Angular está fixado na v21: o Angular 22 exige Node >= 24.15 e TypeScript 6, que conflitam com o toolchain do workspace (veja `docs/decisions/`).

### Rodando localmente

```bash
pnpm turbo run dev --filter=admin   # http://localhost:4200
```

Chamar o `apps/api` diretamente a partir da própria porta do `ng serve` exige ou um proxy de desenvolvimento ou `CORS_ORIGINS=http://localhost:4200` configurado no `apps/api` (veja o `.env.example` da raiz) — atrás do proxy reverso do compose isso não é necessário, já que `admin`/`api` compartilham a mesma origem ali.

### Autenticação

Faz login através do `POST /auth/login` já existente no `apps/api` (o mesmo endpoint usado pela loja) — não existe um sistema de login separado para o admin. A API autentica qualquer credencial válida independente do papel; esta aplicação verifica adicionalmente o papel do usuário resultante (`GET /users/me`) e imediatamente desloga e rejeita qualquer conta que não seja `ADMIN`, com uma mensagem visível, em vez de confiar apenas na chamada de login.

Modelo de sessão (uma SPA client-only, diferente dos cookies httpOnly da loja):

- Access token: mantido apenas em memória, nunca persistido; perdido ao recarregar a página.
- Refresh token: persistido em `localStorage`, trocado silenciosamente por um novo access token na inicialização da aplicação. Essa é uma escolha deliberada e documentada (veja `AuthService`) — não existe um backend first-party nessa arquitetura que pudesse configurar um cookie httpOnly para a SPA do admin, e o risco teórico de exfiltração via XSS é aceito para esta ferramenta interna.
- Um interceptor HTTP anexa `Authorization` em toda requisição e tenta novamente exatamente uma vez em caso de `401`, via um refresh silencioso.

### Rotas

- `/login` — fora do shell da aplicação (sem chrome de navegação).
- `/` — dashboard: contagens agregadas (produtos, categorias, pedidos, pedidos por status), derivadas no client a partir do `meta.total` de endpoints já existentes — sem endpoint dedicado de agregação no backend.
- `/products`, `/products/new`, `/products/:id/edit` — CRUD de catálogo, soft-delete, exibição/correção de estoque por produto.
- `/categories`, `/categories/new`, `/categories/:id/edit` — CRUD de categorias; apagar uma categoria que ainda tem produtos exibe a mensagem `409` da API literalmente.
- `/orders`, `/orders/:id` — revisão de pedidos somente leitura entre todos os clientes (`GET /admin/orders`), filtrável por status. Nenhum controle de edição de status em lugar nenhum: o status do pedido continua controlado exclusivamente pelo fluxo de eventos via QStash (Fase 6).

Toda rota exceto `/login` fica atrás do `adminGuard`, aplicado uma única vez na rota pai do shell.

### Arquitetura

```text
src/app/
  core/
    auth/        AuthService, o interceptor HTTP de autenticação, adminGuard
    http/         ApiClient (wrapper tipado do HttpClient, base path /api/v1)
  shared/
    layout/      AppShell (toolbar + sidenav, layout roteado para toda rota autenticada)
    components/  ConfirmDialog(+Service), DataTable (tabela paginada genérica)
  features/
    auth/        página de login
    dashboard/   contagens agregadas
    products/    listar/criar/editar/apagar + estoque
    categories/  listar/criar/editar/apagar
    orders/      listar/detalhar (somente leitura)
```

Os serviços de feature são donos das próprias chamadas HTTP; componentes ficam apenas com apresentação, seguindo as regras Angular do projeto.

### Variáveis de ambiente

Nenhuma é necessária para rodar o build final da aplicação — ela chama `/api/v1/...` na mesma origem em todo ambiente implantado. Veja o `.env.example` da raiz para `CORS_ORIGINS`, necessário apenas para o `ng serve` local chamando o `apps/api` diretamente.

### Health

No container, o nginx serve `GET /health` → `{"status":"ok","service":"admin"}`.

### Testes

```bash
pnpm --filter admin test        # testes unitários Vitest (services, interceptor, componentes)
pnpm --filter admin lint        # ESLint + angular-eslint
pnpm --filter admin run test:e2e   # suite e2e Playwright — veja abaixo
```

A suite Playwright (`e2e/`) dirige um navegador Chromium real contra instâncias reais e dedicadas de `apps/inventory`/`apps/api`/`apps/admin` e seus próprios bancos de dados (portas/índice do Redis/bancos de teste próprios, distintos das suites e2e do `apps/web` e do `apps/api` — veja `e2e/support/test-env.ts`). Cobre: login `ADMIN` chegando ao dashboard e login `CUSTOMER` sendo rejeitado; criação/edição/soft-delete de produto; um `409` ao apagar categoria que ainda tem produtos; revisão de pedidos entre clientes; e uma consulta/correção de estoque fazendo o round-trip através de uma instância real do `apps/inventory` (o único cenário que não pode ser simulado, já que o `HttpInventoryClient` do `apps/api` é sempre o adapter real em runtime — só o `EventPublisher` tem um toggle fake/real).

### Docker

Construído a partir da raiz do repositório: `docker compose build admin`. Servido atrás do proxy reverso em `http://localhost:8080/admin/`; nenhuma porta do host é publicada diretamente.

---

## English (US)

`ADMIN`-only internal tool: a dashboard, product/category management, read-only order review, and stock correction — all backed by `apps/api`, which itself proxies stock reads/writes to `apps/inventory` (this SPA never talks to Go/Spring Boot directly, per the project's Service-Oriented Architecture rule). Angular 21, standalone components, signals, Angular Material. Served as a static build under `/admin/` behind the reverse proxy.

> Angular is pinned to v21: Angular 22 requires Node >= 24.15 and TypeScript 6, which conflict with the workspace toolchain (see `docs/decisions/`).

### Run locally

```bash
pnpm turbo run dev --filter=admin   # http://localhost:4200
```

Calling `apps/api` directly from `ng serve`'s own port requires either a dev proxy or `CORS_ORIGINS=http://localhost:4200` set on `apps/api` (see the root `.env.example`) — behind the compose reverse proxy this isn't needed, since `admin`/`api` share an origin there.

### Authentication

Logs in via `apps/api`'s existing `POST /auth/login` (same endpoint the storefront uses) — there is no separate admin login system. The API authenticates any valid credentials regardless of role; this app additionally checks the resulting user's role (`GET /users/me`) and immediately logs out and rejects any non-`ADMIN` account with a visible message, rather than trusting the login call alone.

Session model (a client-only SPA, unlike the storefront's httpOnly cookies):

- Access token: kept in memory only, never persisted; lost on a full page reload.
- Refresh token: persisted in `localStorage`, silently exchanged for a new access token on app bootstrap. This is a deliberate, documented trade-off (see `AuthService`) — there is no first-party backend in this architecture that could set an httpOnly cookie for the admin SPA, and the theoretical XSS-exfiltration risk is accepted for this internal tool.
- An HTTP interceptor attaches `Authorization` to every request and retries exactly once on a `401` via a silent refresh.

### Routes

- `/login` — outside the app shell (no nav chrome).
- `/` — dashboard: aggregate counts (products, categories, orders, orders by status), derived client-side from existing endpoints' `meta.total` — no dedicated backend aggregation endpoint.
- `/products`, `/products/new`, `/products/:id/edit` — catalog CRUD, soft-delete, per-product stock display/correction.
- `/categories`, `/categories/new`, `/categories/:id/edit` — category CRUD; deleting a category that still has products surfaces the API's `409` message verbatim.
- `/orders`, `/orders/:id` — read-only order review across every customer (`GET /admin/orders`), filterable by status. No status-editing control anywhere: order status stays exclusively controlled by the QStash-driven event flow (Phase 6).

Every route except `/login` sits behind `adminGuard`, applied once at the shell's parent route.

### Architecture

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

### Environment variables

None required to run the built app itself — it calls same-origin `/api/v1/...` in every deployed environment. See the root `.env.example` for `CORS_ORIGINS`, needed only for local `ng serve` calling `apps/api` directly.

### Health

In the container, nginx serves `GET /health` → `{"status":"ok","service":"admin"}`.

### Testing

```bash
pnpm --filter admin test        # Vitest unit tests (services, interceptor, components)
pnpm --filter admin lint        # ESLint + angular-eslint
pnpm --filter admin run test:e2e   # Playwright e2e suite — see below
```

The Playwright suite (`e2e/`) drives a real Chromium browser against real, dedicated `apps/inventory`/`apps/api`/`apps/admin` dev-server instances and databases (own ports/Redis index/test databases, distinct from `apps/web`'s and `apps/api`'s own e2e suites — see `e2e/support/test-env.ts`). Covers: `ADMIN` login reaching the dashboard and `CUSTOMER` login being rejected; product create/edit/soft-delete; a category-delete `409` when it still has products; cross-customer order review; and a stock lookup/correction round-tripping through a real `apps/inventory` instance (the one scenario that cannot be faked, since `apps/api`'s `HttpInventoryClient` is always the real adapter at runtime — only `EventPublisher` has a fake/real toggle).

### Docker

Built from the repo root: `docker compose build admin`. Served behind the reverse proxy at `http://localhost:8080/admin/`; no host port published directly.
