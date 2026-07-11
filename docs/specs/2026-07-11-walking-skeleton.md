# Spec: Walking Skeleton

- **Date:** 2026-07-11
- **Status:** Approved
- **Phase:** 1

## Overview

Phase 1 stands up the entire system end to end with zero business logic: all five applications scaffolded with their official CLIs, each exposing a `/health` endpoint, each with a production-style multi-stage Dockerfile, all orchestrated by Docker Compose behind an Nginx reverse proxy with PostgreSQL running alongside. A single `docker compose up` turning fully green proves the service boundaries, networking, and deployment shape before any feature work begins.

## Goals

- Scaffold the five apps with official generators, latest stable versions:
  - `apps/web` — `create-next-app` (TypeScript, App Router, Tailwind CSS, ESLint).
  - `apps/admin` — `ng new` (standalone, SCSS; served as static SPA build).
  - `apps/api` — `nest new` (TypeScript, pnpm).
  - `apps/inventory` — `go mod init` + standard library `net/http` server.
  - `apps/payment` — Spring Initializr (Maven, current LTS Java, `web` + `actuator` starters).
- Every service answers `GET /health` with HTTP 200 and JSON `{"status":"ok","service":"<name>"}`.
- One multi-stage Dockerfile per app (build stage → slim runtime stage; non-root where practical).
- Root `docker-compose.yml`: `postgres` (with named volume and healthcheck), `nginx` (single host entrypoint on port 8080), and the five apps with container healthchecks and `depends_on` conditions.
- Nginx path routing: `/` → web, `/admin` → admin, `/api` → api. `inventory` and `payment` remain internal to the Compose network (no published ports, not routed) — frontends may only reach the NestJS API.
- Integrate the TypeScript apps into the pnpm workspace and Turborepo tasks; give `inventory` and `payment` thin `package.json` wrappers (`build`, `dev`) so `pnpm build` and `turbo dev` drive every app uniformly.
- Each app gets a minimal README (purpose, how to run locally, environment variables).
- Daily development runs outside Docker (`turbo dev`, `go run`, `./mvnw spring-boot:run`); Compose is the integration/demo environment mirroring the future Fly.io deployment.

## Non-Goals

- No business features: no auth, products, orders, payments, or stock logic.
- No database access from any app — PostgreSQL runs and is exposed on host port 5432 for later phases, but no service connects to it yet, and there are no migrations.
- No Upstash Redis or QStash wiring (Phases 2, 4-6).
- No Shadcn UI setup or custom storefront UI (Phase 3); no Angular Material setup (Phase 7).
- No hot reload inside containers; no Compose profiles.
- No CI pipeline and no Fly.io deployment (Phase 8).
- No structured-logging frameworks yet — each service's own phase formalizes logging; generated defaults are acceptable in the skeleton.

## Architecture

```text
host :8080 ──► nginx ──► /        ──► web       (Next.js,  :3000)
                    ├──► /admin   ──► admin     (static SPA on nginx, :80)
                    └──► /api     ──► api       (NestJS,   :3001)

compose network only:   inventory (Go,     :8081)
                        payment   (Spring, :8082)
                        postgres  (:5432, also published to host for dev tooling)
```

- All containers share the default Compose network; service discovery by service name.
- Each app owns its Dockerfile in its own directory (`apps/<name>/Dockerfile`); Nginx config lives in `docker/nginx/`.
- Compose healthchecks call each service's `/health` (admin: static `/health` location on its nginx). Nginx `depends_on` all apps with `condition: service_healthy`; apps do not depend on `postgres` in this phase.
- Repository layout after this phase matches the monorepo structure in `.claude/rules/rules-global.md` (`apps/` complete, `docker/` created).
- Clean Architecture folder layering inside `api`, `inventory`, and `payment` starts in their feature phases (2, 4, 5); the skeleton keeps generator defaults plus the health endpoint.

## Data & Contracts

- **Health contract** (all five services): `GET /health` → `200 OK`, `Content-Type: application/json`, body `{"status":"ok","service":"web"|"admin"|"api"|"inventory"|"payment"}`. The payment service remaps Spring Actuator so `/health` serves this shape (or a thin controller wraps it).
- **Ports:** web `3000`, api `3001`, admin `80` (in-container), inventory `8081`, payment `8082`, postgres `5432` (published), nginx `80` in-container → host `8080`. Only nginx and postgres publish host ports.
- **Nginx routes:** `/` → `web:3000`, `/admin/` → `admin:80`, `/api/` → `api:3001` (NestJS global prefix `api`, so `/api/health` resolves). No routes to inventory or payment.
- **Environment:** Postgres credentials come from the root `.env` (documented in `.env.example`, already present); Compose reads them via `env_file`/variable substitution. No new secrets this phase.
- No database schemas, events, or API DTOs are defined in this phase.

## Acceptance Criteria

- `pnpm install && pnpm turbo run build lint` passes with the new TypeScript apps included.
- `go vet ./...` passes in `apps/inventory`; `./mvnw -q test` passes in `apps/payment` (generated context test).
- `docker compose build` succeeds for the five app images (the proxy uses the official `nginx:alpine` image with mounted configuration from `docker/nginx/`).
- `docker compose up -d --wait` exits 0 with every service healthy.
- Through the single entrypoint: `curl -f localhost:8080/api/health` returns the API health JSON; `curl -f localhost:8080/` returns the web page; `curl -f localhost:8080/admin/` returns the admin page.
- Isolation proven: `docker compose exec nginx curl -f http://inventory:8081/health` and `...http://payment:8082/health` succeed from inside the network, while neither service publishes a host port (`docker compose ps` shows none).
- `docker compose down -v` tears everything down cleanly.

## Open Questions

None.
