# api — NestJS API Gateway / BFF

The only backend consumed by the frontends. Auth, users, products, orders, caching, and QStash event publishing arrive in Phase 2+. Global prefix: `/api`.

## Run locally

```bash
pnpm turbo run dev --filter=api   # http://localhost:3001/api
```

## Health

`GET /api/health` → `{"status":"ok","service":"api"}`

## Environment variables

- `PORT` — HTTP port (default `3001`).

Database, Redis, and QStash variables arrive in Phase 2 (see the root `.env.example`).

## Docker

Built from the repo root: `docker compose build api`. Reached through the reverse proxy at `http://localhost:8080/api/`.
