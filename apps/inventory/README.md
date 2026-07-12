# inventory — Go Inventory Service

Owns the stock bounded context (queries, updates, QStash event consumption — arriving in Phase 4). Standard library only; internal service, never exposed through the reverse proxy.

## Run locally

```bash
go run ./cmd/server   # http://localhost:8081  (or: pnpm turbo run dev --filter=inventory)
```

## Health

`GET /health` → `{"status":"ok","service":"inventory"}`

## Environment variables

- `PORT` — HTTP port (default `8081`).

Database and QStash variables arrive in Phase 4.

## Docker

`docker compose build inventory`. Internal-only: reachable as `http://inventory:8081` inside the Compose network; no host port.
