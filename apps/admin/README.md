# admin — Angular Admin Panel

Administrative SPA (dashboard, product/order management, stock updates — arriving in Phase 7). Angular 21, standalone components, SCSS. Served as a static build under `/admin/` and talks only to the NestJS API.

> Angular is pinned to v21: Angular 22 requires Node >= 24.15 and TypeScript 6, which conflict with the workspace toolchain (see `docs/decisions/`).

## Run locally

```bash
pnpm turbo run dev --filter=admin   # http://localhost:4200
```

## Health

In the container, nginx serves `GET /health` → `{"status":"ok","service":"admin"}`.

## Environment variables

None yet. API base URL configuration arrives in Phase 7.

## Docker

Built from the repo root: `docker compose build admin`. Served behind the reverse proxy at `http://localhost:8080/admin/`.
