# Manual verification: the real, cross-service event flow

This is a **manual, user-run guide** — it is not part of `/verify-phase 8` and does not gate that phase's `Done` status. It requires a free Upstash QStash account and a public tunnel (e.g. ngrok), neither of which this repository has access to provision or verify automatically. Every other phase's automated checks (Phases 4-8) deliberately avoid a live Upstash round-trip for exactly this reason — this guide is the one place in the project where you, with your own account, can prove the real thing works.

## What this proves

Every automated test in this project (Phases 4-7's e2e suites) proves the `order.created → inventory decrements stock → payment processes a charge → apps/api updates order status` flow using fakes/test doubles standing in for QStash. This guide walks through flipping on the real adapters (`EVENT_PUBLISHER_MODE=real`, built in this same phase) and watching the identical flow happen for real, asynchronously, through Upstash QStash's actual delivery infrastructure.

## 1. Create an Upstash QStash account

1. Sign up at [upstash.com](https://upstash.com) (free tier is sufficient).
2. Open the **QStash** console. Note your **QSTASH_TOKEN**, **QSTASH_CURRENT_SIGNING_KEY**, and **QSTASH_NEXT_SIGNING_KEY** — these are the same three env vars every service already reads (see `.env.example`).

## 2. Expose the local compose stack publicly

QStash's cloud needs to reach three separate webhook endpoints running in your local compose stack:

- `apps/api`'s own webhook, reachable through the nginx reverse proxy at `http://localhost:8080/api/v1/events/qstash`.
- `apps/inventory`'s webhook at `http://localhost:8081/internal/v1/events/qstash` — **not** normally published to the host (no host port, per its `docker-compose.yml` service definition).
- `apps/payment`'s webhook at `http://localhost:8082/internal/v1/events/qstash` — same situation.

Temporarily publish the two internal services' ports for this exercise only (never do this for anything but a local, throwaway manual test — it's the opposite of their normal "no host port" isolation). Create a scratch override file (do not commit it):

```yaml
# docker-compose.override.yml (local only, delete when done)
services:
  inventory:
    ports:
      - '8081:8081'
  payment:
    ports:
      - '8082:8082'
```

Bring the stack up with the override applied (Compose picks up `docker-compose.override.yml` automatically if present alongside `docker-compose.yml`):

```bash
docker compose up -d --wait
```

Start three ngrok tunnels (the free tier supports multiple simultaneous tunnels via a config file):

```bash
ngrok http 8080 &   # -> apps/api's webhook, via nginx
ngrok http 8081 &   # -> apps/inventory's webhook
ngrok http 8082 &   # -> apps/payment's webhook
```

Note the three `https://<random>.ngrok-free.app` URLs ngrok prints (check `http://localhost:4040` for the ngrok web UI listing all active tunnels if you lose track of which is which).

## 3. Configure QStash and real env vars

In the Upstash QStash console (or via its API), you don't need to pre-create subscriptions — `Client.publishJSON({ url, body })` (the adapter `apps/api` already built) publishes directly to a destination URL per call, no subscription object required. What you need is for each service's `*_DESTINATION_URL`/`*_QSTASH_DESTINATION_URL` env var to be the real ngrok URL for that service, since each service's signature verifier checks the signed request's `url` claim against exactly that value.

Update your local `.env` (create one from `.env.example` if you haven't):

```bash
QSTASH_TOKEN=<your-real-token>
QSTASH_CURRENT_SIGNING_KEY=<your-real-current-signing-key>
QSTASH_NEXT_SIGNING_KEY=<your-real-next-signing-key>

QSTASH_DESTINATION_URL=<inventory's ngrok URL>/internal/v1/events/qstash
PAYMENT_QSTASH_DESTINATION_URL=<payment's ngrok URL>/internal/v1/events/qstash
API_QSTASH_DESTINATION_URL=<api's ngrok URL>/api/v1/events/qstash

EVENT_PUBLISHER_MODE=real
```

Restart the stack so every service picks up the new env vars:

```bash
docker compose up -d --wait
```

## 4. Place a real order and observe

1. Open the storefront at `http://localhost:8080/` (or the admin panel at `http://localhost:8080/admin/`), register/log in as a customer, add a product to the cart, and check out.
2. `apps/api`'s `CreateOrderUseCase` publishes `order.created` — now via the real `QStashEventPublisher` — to both `apps/inventory`'s and `apps/payment`'s real ngrok URLs.
3. Watch each service's logs for the delivery and processing:
   ```bash
   docker compose logs -f inventory payment api
   ```
   You should see `apps/inventory` log a decremented stock quantity and `apps/payment` log a processed charge (`COMPLETED` or `FAILED`, per its configured success rate / the `$666.00` sentinel), each within a few seconds of checkout (QStash's real delivery latency, not instant like the fakes).
4. `apps/payment` then publishes `payment.completed`/`payment.failed` back to `apps/api`'s own real ngrok URL; `apps/api`'s `HandlePaymentEventUseCase` processes it and updates the order's status.
5. Confirm the result:
   - In `apps/admin` (`http://localhost:8080/admin/orders`), find the order and confirm its status is now `PAID` or `PAYMENT_FAILED` (no longer `PLACED`).
   - In `apps/admin` (`http://localhost:8080/admin/products`), confirm the ordered product's stock quantity decreased by the ordered amount.

This proves the exact same flow every automated test proves with fakes, now genuinely asynchronous and running through a real message broker end to end.

## 5. Clean up

```bash
kill %1 %2 %3          # stop the three ngrok tunnels (or Ctrl+C each)
rm docker-compose.override.yml
docker compose down -v
```

Set `EVENT_PUBLISHER_MODE` back to `fake` (or just delete/reset your local `.env`, matching `.env.example`'s default) before running any of this project's other automated verification again — every phase's `/verify-phase` assumes the fake default.
