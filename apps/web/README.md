# web — Next.js Storefront

Customer-facing store (catalog, cart, checkout, orders — arriving in Phase 3). Next.js 16 App Router, Server Components by default, Tailwind CSS. Talks only to the NestJS API.

## Run locally

```bash
pnpm turbo run dev --filter=web   # http://localhost:3000
```

## Health

`GET /health` → `{"status":"ok","service":"web"}`

## Environment variables

None yet. API base URL configuration arrives in Phase 3.

## Docker

Built from the repo root: `docker compose build web`. Served behind the reverse proxy at `http://localhost:8080/`.
