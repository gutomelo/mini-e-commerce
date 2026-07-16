# Deploying to Fly.io

This is a **manual, user-run guide**. Nothing here is executed or verified automatically by `/verify-phase 8` — deploying requires a real Fly.io account and billing details this repository has no access to. The deliverable of Phase 8 is the `fly.toml` files and this guide; running `flyctl deploy` for real is your own follow-up action.

## Topology

Six apps in total, mirroring the Docker Compose topology exactly:

| Fly app                    | Config                        | Public? | Notes                                                                        |
| -------------------------- | ----------------------------- | ------- | ---------------------------------------------------------------------------- |
| `mini-ecommerce-web`       | `apps/web/fly.toml`           | Yes     | Next.js storefront                                                           |
| `mini-ecommerce-admin`     | `apps/admin/fly.toml`         | Yes     | Angular admin panel — served at `/admin/` (see note below)                   |
| `mini-ecommerce-api`       | `apps/api/fly.toml`           | Yes     | NestJS API Gateway/BFF                                                       |
| `mini-ecommerce-inventory` | `apps/inventory/fly.toml`     | No      | Go inventory service — private networking only, no public route              |
| `mini-ecommerce-payment`   | `apps/payment/fly.toml`       | No      | Spring Boot payment service — private networking only, no public route       |
| (Postgres cluster)         | provisioned separately, below | No      | Backs all three databases (`mini_ecommerce`, `..._inventory`, `..._payment`) |

`apps/inventory` and `apps/payment` deliberately have no `[http_service]`/`[[services]]` block in their `fly.toml` — this means Fly never assigns them a public route or TLS certificate. `apps/api` still reaches them over Fly's private networking (6PN) at `mini-ecommerce-inventory.internal:8081` / `mini-ecommerce-payment.internal:8082`, no extra configuration required — every Fly app is reachable over 6PN by default, the same "frontends/public internet never reach Go or Spring Boot directly" rule the reverse-proxy topology already enforces, now enforced at the deployment layer too.

**`apps/admin` note**: its Docker image bakes in Angular's `baseHref: /admin/` (matching how the compose reverse proxy always reaches it under that path prefix). Deployed as its own standalone Fly app, visit `https://mini-ecommerce-admin.fly.dev/admin/` — not the bare domain root, which 404s (no `location /` catch-all in `apps/admin/nginx/default.conf`). This is a one-line quirk to remember, not a bug requiring a rebuild.

Fly is region-agnostic for this guide; every `fly.toml` here defaults to `primary_region = "gru"` (São Paulo) — change it to whichever region is closest to you before creating the apps.

## Prerequisites

- A Fly.io account and the `flyctl` CLI installed and authenticated (`flyctl auth login`).
- All commands below assume your shell's working directory is the repository root unless stated otherwise.

## 1. Provision Postgres

Fly Postgres backs all three logical databases this project already uses on a single Postgres instance in compose (`mini_ecommerce`, `mini_ecommerce_inventory`, `mini_ecommerce_payment`) — one Fly Postgres cluster, three databases inside it, exactly mirroring the compose container:

```bash
flyctl postgres create --name mini-ecommerce-db --region gru --vm-size shared-cpu-1x --volume-size 1
```

Connect and create the two additional databases (`postgres create` only creates one, typically named after the app):

```bash
flyctl postgres connect -a mini-ecommerce-db
```

```sql
CREATE DATABASE mini_ecommerce_inventory;
CREATE DATABASE mini_ecommerce_payment;
```

Note the connection string Fly prints when the cluster is created (or run `flyctl postgres db list -a mini-ecommerce-db` / `flyctl secrets list -a mini-ecommerce-db` to retrieve it again) — you'll compose per-service `DATABASE_URL`-style secrets from it in step 3, swapping only the database name and using the cluster's Fly-internal hostname (e.g. `mini-ecommerce-db.internal` or the flycast address Fly prints) rather than a public host.

## 2. Reuse existing Upstash accounts

This project already assumes Upstash Redis and Upstash QStash accounts (see the root `.env.example`) — reuse the same ones for production rather than provisioning a new managed cache:

- **Upstash Redis**: create a Redis database at [upstash.com](https://upstash.com) if you don't already have one from local development; use its `rediss://` connection string as `REDIS_URL`.
- **Upstash QStash**: use your existing token/signing keys; you'll need `EVENT_PUBLISHER_MODE=real` plus real destination URLs once every app has a real public/internal Fly address (see `docs/manual-verification/real-event-flow.md` for the equivalent local-tunnel version of this same idea — the Fly deployment gives every service a real public or `.internal` address, which is actually a more natural fit for QStash's real delivery than a local ngrok tunnel).

## 3. Create the apps and set secrets

Create apps in dependency order: databases first (done above), then `inventory`/`payment` (so `api` can reach them once it starts), then `api`, then `web`/`admin`.

```bash
# --- inventory ---
cd apps/inventory
flyctl apps create mini-ecommerce-inventory
flyctl secrets set \
  INVENTORY_DATABASE_URL="postgresql://postgres:<password>@mini-ecommerce-db.internal:5432/mini_ecommerce_inventory" \
  INTERNAL_API_KEY="<a-real-random-secret>" \
  API_BASE_URL="https://mini-ecommerce-api.fly.dev" \
  QSTASH_TOKEN="<your-upstash-qstash-token>" \
  QSTASH_CURRENT_SIGNING_KEY="<...>" \
  QSTASH_NEXT_SIGNING_KEY="<...>" \
  QSTASH_DESTINATION_URL="https://mini-ecommerce-inventory.fly.dev/internal/v1/events/qstash" \
  EVENT_PUBLISHER_MODE="fake" \
  -a mini-ecommerce-inventory
flyctl deploy
cd ../..

# --- payment ---
cd apps/payment
flyctl apps create mini-ecommerce-payment
flyctl secrets set \
  PAYMENT_DATABASE_URL="jdbc:postgresql://mini-ecommerce-db.internal:5432/mini_ecommerce_payment?user=postgres&password=<password>" \
  INTERNAL_API_KEY="<a-different-real-random-secret>" \
  PAYMENT_GATEWAY_SUCCESS_RATE="0.9" \
  QSTASH_TOKEN="<your-upstash-qstash-token>" \
  QSTASH_CURRENT_SIGNING_KEY="<...>" \
  QSTASH_NEXT_SIGNING_KEY="<...>" \
  PAYMENT_QSTASH_DESTINATION_URL="https://mini-ecommerce-payment.fly.dev/internal/v1/events/qstash" \
  EVENT_PUBLISHER_MODE="fake" \
  -a mini-ecommerce-payment
flyctl deploy
cd ../..

# --- api ---
flyctl apps create mini-ecommerce-api
flyctl secrets set \
  DATABASE_URL="postgresql://postgres:<password>@mini-ecommerce-db.internal:5432/mini_ecommerce" \
  REDIS_URL="<your-upstash-rediss-url>" \
  JWT_ACCESS_SECRET="<a-real-random-secret>" \
  JWT_REFRESH_SECRET="<a-different-real-random-secret>" \
  JWT_ACCESS_TTL="15m" \
  JWT_REFRESH_TTL="7d" \
  ADMIN_EMAIL="<your-admin-email>" \
  ADMIN_PASSWORD="<a-real-strong-password>" \
  QSTASH_TOKEN="<your-upstash-qstash-token>" \
  QSTASH_CURRENT_SIGNING_KEY="<...>" \
  QSTASH_NEXT_SIGNING_KEY="<...>" \
  QSTASH_DESTINATION_URL="https://mini-ecommerce-inventory.fly.dev/internal/v1/events/qstash" \
  PAYMENT_QSTASH_DESTINATION_URL="https://mini-ecommerce-payment.fly.dev/internal/v1/events/qstash" \
  API_QSTASH_DESTINATION_URL="https://mini-ecommerce-api.fly.dev/api/v1/events/qstash" \
  CORS_ORIGINS="" \
  INVENTORY_BASE_URL="http://mini-ecommerce-inventory.internal:8081" \
  INVENTORY_INTERNAL_API_KEY="<same value as apps/inventory's INTERNAL_API_KEY above>" \
  EVENT_PUBLISHER_MODE="fake" \
  -a mini-ecommerce-api
flyctl deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile .

# --- web ---
flyctl apps create mini-ecommerce-web
flyctl secrets set API_BASE_URL="https://mini-ecommerce-api.fly.dev" -a mini-ecommerce-web
flyctl deploy --config apps/web/fly.toml --dockerfile apps/web/Dockerfile .

# --- admin ---
flyctl apps create mini-ecommerce-admin
flyctl deploy --config apps/admin/fly.toml --dockerfile apps/admin/Dockerfile .
```

Notes:

- `EVENT_PUBLISHER_MODE` is left as `fake` above intentionally — flip all three to `real` only once you've confirmed the real cross-service flow works (see `docs/manual-verification/real-event-flow.md`), since setting it to `real` without valid QStash credentials/destination URLs configured on QStash's side would mean published events silently fail to deliver.
- `apps/inventory` and `apps/payment` don't need `flyctl apps create` to be followed by their own `flyctl deploy --config ... --build-context .` invocation, since their Dockerfiles are self-contained (matching `docker-compose.yml`'s own `context: apps/inventory`/`context: apps/payment`) — running plain `flyctl deploy` from inside each app's own directory (where its `fly.toml` already lives) is sufficient, shown above.
- Every secret above corresponds 1:1 to an entry in the root `.env.example` — cross-reference that file if a value's purpose is unclear.

## 4. Verify

```bash
flyctl status -a mini-ecommerce-web
flyctl status -a mini-ecommerce-admin
flyctl status -a mini-ecommerce-api
flyctl status -a mini-ecommerce-inventory
flyctl status -a mini-ecommerce-payment
curl https://mini-ecommerce-api.fly.dev/api/health
curl https://mini-ecommerce-web.fly.dev/health
curl https://mini-ecommerce-admin.fly.dev/admin/
```

## Redeploying after a code change

```bash
cd apps/inventory && flyctl deploy && cd ../..
cd apps/payment && flyctl deploy && cd ../..
flyctl deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile .
flyctl deploy --config apps/web/fly.toml --dockerfile apps/web/Dockerfile .
flyctl deploy --config apps/admin/fly.toml --dockerfile apps/admin/Dockerfile .
```
