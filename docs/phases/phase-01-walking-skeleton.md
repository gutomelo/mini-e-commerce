# Phase 01 — Walking Skeleton

- **Spec:** [walking skeleton](../specs/2026-07-11-walking-skeleton.md)
- **Roadmap:** [ROADMAP.md](../ROADMAP.md)

## Objective

Stand up all five applications end to end with zero business logic: official-CLI scaffolds, a `/health` endpoint on every service, one multi-stage Dockerfile per app, and a root Docker Compose with PostgreSQL and an Nginx single entrypoint on `localhost:8080`. Done means `docker compose up -d --wait` turns fully green and the routing/isolation rules are proven by the verification commands.

## Prerequisites

- [x] Phase 0 is `Done` in [ROADMAP.md](../ROADMAP.md)
- [x] Spec for this phase is `Approved`

## Tasks

- [x] Scaffold `apps/web` with `create-next-app` (TypeScript, App Router, Tailwind, ESLint, pnpm); wire workspace Prettier config; add `GET /health` route handler returning `{"status":"ok","service":"web"}` (owner: nextjs-developer)
- [x] Scaffold `apps/api` with `nest new` (pnpm); set global prefix `api` and port `3001`; add `GET /api/health` returning `{"status":"ok","service":"api"}` (owner: nestjs-developer)
- [x] Scaffold `apps/admin` with `ng new` (standalone, SCSS, no SSR); configure `baseHref` `/admin/`; keep generator ESLint/test defaults (owner: angular-developer)
- [x] Scaffold `apps/inventory` with `go mod init`; standard-library `net/http` server on `8081` with `GET /health` returning `{"status":"ok","service":"inventory"}` (owner: go-developer)
- [x] Scaffold `apps/payment` via Spring Initializr (Maven, current LTS Java, `web` + `actuator`); port `8082`; expose `GET /health` returning `{"status":"ok","service":"payment"}` (owner: spring-developer)
- [x] Integrate all apps into the workspace: web/admin/api run under `turbo build lint dev`; add thin `package.json` wrappers (`build`, `dev`) to inventory and payment so Turborepo drives every app (owner: main)
- [x] Multi-stage Dockerfile for `apps/web` (standalone Next.js output, non-root runtime) (owner: nextjs-developer)
- [x] Multi-stage Dockerfile for `apps/api` (build → slim Node runtime, non-root) (owner: nestjs-developer)
- [x] Multi-stage Dockerfile for `apps/admin` (Angular build → `nginx:alpine` static serve with `/health` location) (owner: angular-developer)
- [x] Multi-stage Dockerfile for `apps/inventory` (Go build → minimal runtime image) (owner: go-developer)
- [x] Multi-stage Dockerfile for `apps/payment` (Maven build → JRE runtime image) (owner: spring-developer)
- [x] Reverse proxy config in `docker/nginx/`: `/` → web, `/admin/` → admin, `/api/` → api; no routes to inventory/payment (owner: main)
- [x] Root `docker-compose.yml`: postgres (named volume, healthcheck, host port 5432), nginx (host port 8080), five apps with `/health` healthchecks and `depends_on`; only nginx and postgres publish host ports (owner: main)
- [ ] Add a minimal README to each app (purpose, local run, env vars) and update the root README with the Compose workflow (owner: main)

## Acceptance Criteria

- Monorepo build and lint stay green with the three TypeScript apps included.
- Go code passes `go vet`; the generated Spring context test passes.
- All five app images build; `docker compose up -d --wait` exits 0 with every service healthy.
- The single entrypoint serves the web page (`/`), the admin page (`/admin/`), and the API health JSON (`/api/health`).
- `inventory` and `payment` answer `/health` inside the Compose network but publish no host ports.
- Teardown is clean (`docker compose down -v` exits 0).

## Verification

- [ ] `pnpm install` — completes without errors
- [ ] `pnpm turbo run build lint` — passes for all packages and apps
- [ ] `(cd apps/inventory && go vet ./...)` — exits 0
- [ ] `(cd apps/payment && ./mvnw -q test)` — exits 0 (generated context test passes)
- [ ] `docker compose build` — all five app images build successfully
- [ ] `docker compose up -d --wait` — exits 0 with all services healthy
- [ ] `curl -fsS http://localhost:8080/api/health` — returns `{"status":"ok","service":"api"}`
- [ ] `curl -fsS -o /dev/null http://localhost:8080/` — exits 0 (web served through the proxy)
- [ ] `curl -fsS -o /dev/null http://localhost:8080/admin/` — exits 0 (admin served through the proxy)
- [ ] `docker compose exec nginx curl -fsS http://inventory:8081/health` — returns `{"status":"ok","service":"inventory"}`
- [ ] `docker compose exec nginx curl -fsS http://payment:8082/health` — returns `{"status":"ok","service":"payment"}`
- [ ] `! docker compose ps inventory payment | grep '0.0.0.0'` — exits 0 (no host ports published for internal services)
- [ ] `docker compose down -v` — exits 0 (clean teardown)
