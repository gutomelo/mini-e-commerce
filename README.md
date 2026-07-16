# Mini E-Commerce

[![CI](https://github.com/gutomelo/mini-e-commerce/actions/workflows/ci.yml/badge.svg)](https://github.com/gutomelo/mini-e-commerce/actions/workflows/ci.yml)

🇧🇷 [Português (Brasil)](#português-brasil) · 🇺🇸 [English (US)](#english-us)

---

## Português (Brasil)

Um monorepo de e-commerce de portfólio demonstrando arquitetura moderna em múltiplas stacks: Clean Architecture, comunicação orientada a eventos, cache distribuído e um fluxo de engenharia profissional — com funcionalidade propositalmente simples.

### Estrutura do monorepo

```text
apps/
├── web/          # Storefront em Next.js (App Router, Shadcn UI, Tailwind)
├── admin/        # Painel administrativo em Angular (Angular Material)
├── api/          # API Gateway/BFF em NestJS (auth, produtos, pedidos, cache, eventos)
├── inventory/    # Serviço de estoque em Go (estoque, consumidores de eventos)
└── payment/      # Serviço de pagamento em Spring Boot (gateway simulado)

packages/
├── config/       # Configurações compartilhadas de ESLint, Prettier e TypeScript
├── types/        # Tipos de DTO e contratos de eventos compartilhados
├── shared/       # Utilitários compartilhados (correlation ids, envelopes de eventos)
└── ui/           # Componentes React compartilhados

docs/             # Roadmap, specs, checklists de fase, registros de decisão
```

### Serviços e responsabilidades

| Serviço   | Stack                          | Responsabilidade                                                                                                       |
| --------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| web       | Next.js 16+, React, TypeScript | Experiência do cliente: catálogo, carrinho, checkout, pedidos                                                          |
| admin     | Angular 21, TypeScript         | Dashboard, gestão de produtos/categorias, revisão de pedidos, atualização de estoque                                   |
| api       | NestJS, TypeScript             | Único backend para os dois frontends: auth JWT, usuários, produtos, pedidos, cache Redis, publicação de eventos QStash |
| inventory | Go                             | Consultas/atualizações de estoque, consumidores de eventos idempotentes                                                |
| payment   | Spring Boot, Java              | Gateway de pagamento simulado, registros e status de pagamento                                                         |

Os frontends só falam com a API NestJS. Inventory e Payment são serviços independentes integrados via eventos (Upstash QStash) e REST, rastreando cada requisição com um correlation id.

### Infraestrutura

PostgreSQL (instância única, só migrações), Upstash Redis (cache de leitura, TTL de 5 minutos), Upstash QStash (barramento de eventos), Docker + Docker Compose, proxy reverso Nginx, alvo de deploy no Fly.io.

### Fluxo de desenvolvimento

O trabalho avança por fases rastreadas em [docs/ROADMAP.md](docs/ROADMAP.md), cada uma seguindo spec → plano → implementação → verificação, com um gate de verificação bloqueante. O fluxo é conduzido por skills do Claude Code (veja [CLAUDE.md](CLAUDE.md)) e reforçado por git hooks:

- **pre-commit** — lint-staged formata os arquivos staged com Prettier (o ESLint roda via `pnpm lint`).
- **commit-msg** — o commitlint exige [Conventional Commits](https://www.conventionalcommits.org).

### Como começar

Requisitos: Node.js >= 22 (com corepack), pnpm 11 (`corepack enable pnpm`), Go 1.25+, JDK 21, Docker + Compose.

```bash
pnpm install        # instala as dependências de todo o workspace
pnpm build          # turbo run build em pacotes/apps
pnpm lint           # turbo run lint
pnpm test           # turbo run test
pnpm format         # prettier --write .
```

As variáveis de ambiente estão documentadas em [.env.example](.env.example). Copie para `.env` e preencha com valores reais — arquivos `.env` reais nunca são commitados.

### Docker Compose (ambiente de integração)

Imagens no estilo produção para os cinco apps atrás de um único ponto de entrada Nginx:

```bash
docker compose build          # constrói as cinco imagens dos apps
docker compose up -d --wait   # postgres + apps + proxy, todos com healthcheck
docker compose down -v        # teardown limpo
```

- `http://localhost:8080/` — storefront (web)
- `http://localhost:8080/admin/` — painel administrativo
- `http://localhost:8080/api/health` — API gateway
- `inventory` e `payment` são internos (sem portas de host) — os frontends falam exclusivamente com a API
- O PostgreSQL é publicado em `localhost:5433` para ferramentas de desenvolvimento (o container escuta em 5432 na rede interna; 5433 evita conflito com um PostgreSQL local no host)

O desenvolvimento diário roda fora do Docker (`pnpm dev`, `go run ./cmd/server`, `./mvnw spring-boot:run`); o Compose é o ambiente de integração/demonstração que espelha a topologia de deploy do Fly.io (veja [Deployment](#deployment) abaixo).

> O TypeScript está fixado na linha 5.9.x em todo o workspace (overrides em `pnpm-workspace.yaml`) até que o typescript-eslint suporte TypeScript >= 6.

### Testes

- **apps/web** e **apps/admin** têm, cada um, uma suite e2e em Playwright (`pnpm --filter web run test:e2e`, `pnpm --filter admin run test:e2e`) dirigindo um navegador real contra instâncias reais e dedicadas de dev-server e bancos de dados — a do storefront cobre registro → login → catálogo → carrinho → checkout → histórico de pedidos; a do painel administrativo cobre login de ADMIN/rejeição de CUSTOMER, CRUD de produtos/categorias, revisão de pedidos entre clientes, e consulta/correção de estoque (o único fluxo que passa por uma instância real do `apps/inventory` em Go).
- **apps/api** tem tanto uma suite de testes unitários em Jest (ports mockados, sem infraestrutura real) quanto uma suite e2e em Jest contra um Postgres/Redis real e dedicado (`pnpm --filter api run test:e2e`) cobrindo rotação de autenticação, RBAC, paginação/cache/throttling, o fluxo completo de pedidos orientado a eventos, e os endpoints exclusivos de admin.
- **apps/inventory** (`go test ./...`) e **apps/payment** (`./mvnw test`) têm, cada um, suas próprias suites de teste unitário e de integração, incluindo payloads de webhook QStash assinados manualmente que provam o consumo idempotente de eventos sem depender de uma conta Upstash real.
- O CI (`.github/workflows/ci.yml`) roda `pnpm turbo run build lint test` em cada push/PR — o mesmo comando que dirige todos os apps de forma uniforme, incluindo Go e Java, via seus wrappers finos de `package.json`.
- `docs/manual-verification/real-event-flow.md` é a única exceção: um guia manual, executado pelo usuário, para provar o fluxo real (não simulado) de eventos entre serviços contra uma conta Upstash QStash de verdade.

### Deployment

O Fly.io é o alvo de deploy: um `fly.toml` por app (`apps/web/fly.toml`, `apps/admin/fly.toml`, `apps/api/fly.toml`, `apps/inventory/fly.toml`, `apps/payment/fly.toml`), espelhando exatamente as regras de acesso da topologia do Compose — `apps/inventory` e `apps/payment` não têm rota pública, alcançáveis apenas pelo `apps/api` via rede privada do Fly, a mesma regra de "frontends nunca acessam Go ou Spring Boot diretamente" aplicada na camada de deploy. Veja [docs/deployment/fly-io.md](docs/deployment/fly-io.md) para a sequência completa de criação de apps, secrets e deploy — um guia manual, executado pelo usuário, já que não há uma conta Fly.io real disponível aqui para executá-lo ou verificá-lo automaticamente.

### Documentação

- [docs/ROADMAP.md](docs/ROADMAP.md) — status das fases (fonte única de verdade)
- [docs/specs/](docs/specs/) — especificações aprovadas
- [docs/phases/](docs/phases/) — checklists executáveis de cada fase
- [docs/decisions/](docs/decisions/) — registros de decisão
- [docs/deployment/fly-io.md](docs/deployment/fly-io.md) — guia de deploy no Fly.io
- [docs/manual-verification/real-event-flow.md](docs/manual-verification/real-event-flow.md) — como provar o fluxo real de eventos entre serviços contra uma conta Upstash QStash de verdade

---

## English (US)

A portfolio e-commerce monorepo demonstrating modern architecture across multiple stacks: Clean Architecture, event-driven communication, distributed caching, and professional engineering workflow — with intentionally simple functionality.

### Monorepo structure

```text
apps/
├── web/          # Next.js storefront (App Router, Shadcn UI, Tailwind)
├── admin/        # Angular admin panel (Angular Material)
├── api/          # NestJS API Gateway/BFF (auth, products, orders, cache, events)
├── inventory/    # Go inventory service (stock, event consumers)
└── payment/      # Spring Boot payment service (simulated gateway)

packages/
├── config/       # Shared ESLint, Prettier, and TypeScript configs
├── types/        # Shared DTO and event contract types
├── shared/       # Shared utilities (correlation ids, event envelopes)
└── ui/           # Shared React UI components

docs/             # Roadmap, specs, phase checklists, decision records
```

### Services and responsibilities

| Service   | Stack                          | Responsibility                                                                                             |
| --------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| web       | Next.js 16+, React, TypeScript | Customer experience: catalog, cart, checkout, orders                                                       |
| admin     | Angular 21, TypeScript         | Dashboard, product/category management, order review, stock updates                                        |
| api       | NestJS, TypeScript             | Single backend for both frontends: JWT auth, users, products, orders, Redis cache, QStash event publishing |
| inventory | Go                             | Stock queries/updates, idempotent event consumers                                                          |
| payment   | Spring Boot, Java              | Simulated payment gateway, payment records and status                                                      |

Frontends talk only to the NestJS API. Inventory and Payment are independent services integrated through events (Upstash QStash) and REST, tracing every request with a correlation id.

### Infrastructure

PostgreSQL (single instance, migrations only), Upstash Redis (read cache, 5-minute TTL), Upstash QStash (event bus), Docker + Docker Compose, Nginx reverse proxy, Fly.io deployment target.

### Development workflow

Work advances through phases tracked in [docs/ROADMAP.md](docs/ROADMAP.md), each following spec → plan → implement → verify with a blocking verification gate. The workflow is driven by Claude Code skills (see [CLAUDE.md](CLAUDE.md)) and enforced by git hooks:

- **pre-commit** — lint-staged formats staged files with Prettier (ESLint runs via `pnpm lint`).
- **commit-msg** — commitlint enforces [Conventional Commits](https://www.conventionalcommits.org).

### Getting started

Requirements: Node.js >= 22 (with corepack), pnpm 11 (`corepack enable pnpm`), Go 1.25+, JDK 21, Docker + Compose.

```bash
pnpm install        # install all workspace dependencies
pnpm build          # turbo run build across packages/apps
pnpm lint           # turbo run lint
pnpm test           # turbo run test
pnpm format         # prettier --write .
```

Environment variables are documented in [.env.example](.env.example). Copy it to `.env` and fill in real values — real `.env` files are never committed.

### Docker Compose (integration environment)

Production-style images for all five apps behind an Nginx single entrypoint:

```bash
docker compose build          # build the five app images
docker compose up -d --wait   # postgres + apps + proxy, all healthchecked
docker compose down -v        # clean teardown
```

- `http://localhost:8080/` — storefront (web)
- `http://localhost:8080/admin/` — admin panel
- `http://localhost:8080/api/health` — API gateway
- `inventory` and `payment` are internal-only (no host ports) — frontends talk exclusively to the API
- PostgreSQL is published on `localhost:5433` for development tooling (the container listens on 5432 in-network; 5433 avoids clashing with a host PostgreSQL)

Daily development runs outside Docker (`pnpm dev`, `go run ./cmd/server`, `./mvnw spring-boot:run`); Compose is the integration/demo environment mirroring the Fly.io deployment topology (see [Deployment](#deployment) below).

> TypeScript is pinned to the 5.9.x line workspace-wide (`pnpm-workspace.yaml` overrides) until typescript-eslint supports TypeScript >= 6.

### Testing

- **apps/web** and **apps/admin** each have a Playwright e2e suite (`pnpm --filter web run test:e2e`, `pnpm --filter admin run test:e2e`) driving a real browser against real, dedicated dev-server instances and databases — the storefront's covers register → login → catalog → cart → checkout → order history; the admin panel's covers ADMIN login/CUSTOMER rejection, product/category CRUD, cross-customer order review, and stock lookup/correction (the one flow that round-trips through a real `apps/inventory` Go instance).
- **apps/api** has both a Jest unit suite (mocked ports, no real infra) and a Jest e2e suite against a real, dedicated Postgres/Redis (`pnpm --filter api run test:e2e`) covering auth rotation, RBAC, pagination/cache/throttling, the full event-driven order flow, and the admin-only endpoints.
- **apps/inventory** (`go test ./...`) and **apps/payment** (`./mvnw test`) each have their own unit and integration suites, including hand-signed QStash webhook payloads proving idempotent event consumption without depending on a live Upstash account.
- CI (`.github/workflows/ci.yml`) runs `pnpm turbo run build lint test` on every push/PR — the same command that drives every app uniformly, Go and Java included, via their thin `package.json` wrappers.
- `docs/manual-verification/real-event-flow.md` is the one exception: a manual, user-run guide for proving the real (not faked) cross-service event flow against a live Upstash QStash account.

### Deployment

Fly.io is the deployment target: one `fly.toml` per app (`apps/web/fly.toml`, `apps/admin/fly.toml`, `apps/api/fly.toml`, `apps/inventory/fly.toml`, `apps/payment/fly.toml`), mirroring the Compose topology's access rules exactly — `apps/inventory` and `apps/payment` get no public route, reachable only from `apps/api` over Fly's private networking, the same "frontends never reach Go or Spring Boot directly" rule enforced at the deployment layer. See [docs/deployment/fly-io.md](docs/deployment/fly-io.md) for the full app-creation, secrets, and deploy sequence — a manual, user-run guide, since no live Fly.io account is available to execute or verify it automatically here.

### Documentation

- [docs/ROADMAP.md](docs/ROADMAP.md) — phase status (single source of truth)
- [docs/specs/](docs/specs/) — approved specifications
- [docs/phases/](docs/phases/) — executable phase checklists
- [docs/decisions/](docs/decisions/) — decision records
- [docs/deployment/fly-io.md](docs/deployment/fly-io.md) — Fly.io deployment guide
- [docs/manual-verification/real-event-flow.md](docs/manual-verification/real-event-flow.md) — proving the real cross-service event flow against a live Upstash QStash account
