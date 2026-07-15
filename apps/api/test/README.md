# E2E test suite

Runs with `pnpm --filter api run test:e2e` (Jest, config: `test/jest-e2e.json`).

## Test database strategy

The suite runs against a **dedicated database**, `mini_ecommerce_test`, on the
same Postgres instance the compose stack already exposes at
`localhost:5433` (`docker compose up -d --wait postgres redis`) — never
against the dev `mini_ecommerce` database. This keeps the suite free to
truncate and reseed without disturbing data a developer might be inspecting
via `docker compose up`, and keeps every run byte-for-byte reproducible.

Redis is shared with dev at `localhost:6380`, but the suite uses **logical DB
index 1** (`redis://localhost:6380/1`) so its keys never collide with
whatever a developer has cached on index 0 while poking at the API locally.

### Why not a `.env.test` file

The repo's secrets-protection hook blocks the agent from creating or editing
any `.env*` file (only `.env.example` is allowed). There is nothing secret in
the test configuration anyway — fixed, local-only credentials — so it lives
in a plain TypeScript module instead: `test/support/test-env.ts`.

### Bootstrap sequence

1. **`test/setup-env.ts`** (Jest `setupFiles`, runs in every worker before the
   test framework and any test file/module is evaluated): calls
   `applyTestEnv()`, which sets `DATABASE_URL`, `REDIS_URL`, and the JWT/admin
   env vars on `process.env` _before_ `PrismaService`, `RedisCacheAdapter`, or
   `JwtTokenService` read them at construction time.
2. **`test/global-setup.ts`** (Jest `globalSetup`, runs once before any
   worker starts):
   - creates `mini_ecommerce_test` if it doesn't exist yet (via a `pg` client
     against the `postgres` maintenance database);
   - applies migrations with `prisma migrate deploy` (same command
     `docker compose`'s api container runs on start, per
     `docs/phases/phase-02-api-core.md`'s verification list);
   - truncates every table (`RESTART IDENTITY CASCADE`);
   - reseeds via the existing `prisma/seed.ts` script (admin user + the 3
     categories / 12 products demo catalog), pointed at the test database.

Truncating + reseeding at the start of every run (rather than relying on
per-test cleanup) is what makes `pnpm --filter api run test:e2e` **idempotent
across reruns**: whatever a previous run left behind is wiped before the next
run's first test executes.

### Avoiding cross-file/cross-run collisions

- `test/jest-e2e.json` sets `"testTimeout": 30000`; `package.json`'s
  `test:e2e` script passes `--runInBand` so specs run sequentially in one
  process. This keeps the throttling test's rate-limit bucket (in-memory,
  scoped to its own `INestApplication` instance) isolated from every other
  spec's login calls, and avoids the shared Postgres/Redis state racing
  across parallel workers.
- Every spec that creates data uses a random suffix
  (`test/support/fixtures.ts#uniqueSuffix`) for emails/slugs, so reruns
  within the same overall test run (or accidental overlap) never hit a
  unique-constraint conflict.
- Specs that need pagination/filtering assertions against **known** data
  (`products.e2e-spec.ts`) rely on the seeded catalog's fixed 3
  categories / 12 products. Every other spec that needs to write a
  category/product creates its **own** dedicated category first (see
  `rbac.e2e-spec.ts`, `cache.e2e-spec.ts`) instead of writing into
  `electronics`/`apparel`/`home-kitchen`, so the pagination counts never
  drift based on file execution order.

## Coverage (spec acceptance criteria)

| Area                                                                                                                                                                                                                                                                                                               | File                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| Register → login → protected route → refresh rotation → reused token rejected → logout revokes                                                                                                                                                                                                                     | `auth.e2e-spec.ts`       |
| RBAC: CUSTOMER blocked (403) / ADMIN allowed (201) on product & category writes                                                                                                                                                                                                                                    | `rbac.e2e-spec.ts`       |
| Pagination (`page`/`limit`/`meta`), filtering (`search`/`category`/`minPrice`/`maxPrice`), sorting (`sort`)                                                                                                                                                                                                        | `products.e2e-spec.ts`   |
| Cache hit (repeated read served consistently, verified directly against Redis for categories) + invalidation on write (categories and products)                                                                                                                                                                    | `cache.e2e-spec.ts`      |
| Throttling: 429 after the 10 req/min `auth` bucket on `/auth/login`                                                                                                                                                                                                                                                | `throttling.e2e-spec.ts` |
| Health check                                                                                                                                                                                                                                                                                                       | `app.e2e-spec.ts`        |
| Event-driven integration: `order.created` publish (one event, correct `correlationId`/`totalCents`/`items`) + `payment.completed`/`payment.failed` consumption via `/events/qstash` (status transitions, idempotent redelivery, invalid-signature 401, unsupported-event 400)                                      | `events.e2e-spec.ts`     |
| Admin panel: `GET /admin/orders` (+ `:id`) cross-customer visibility, status filter (valid/invalid), 401/403/404 — and `GET`/`PATCH /admin/inventory/:productId` against a `FakeInventoryClient` (seeded quantity, update, negative-quantity 400, malformed-id 400, unseeded-id 404), all with 401/403 RBAC checks | `admin.e2e-spec.ts`      |

## Support files

- `test/support/test-env.ts` — the test environment constants + `applyTestEnv()`.
- `test/support/test-app.ts` — `createTestApp()` boots a full Nest app
  mirroring `src/main.ts` exactly (URI versioning, global prefix,
  `ValidationPipe`, correlation-id middleware, pino logger); `api()` is a
  `supertest` shorthand; `bodyOf<T>()` casts a response body to its expected
  envelope type. `createTestApp({ fakeInventoryClient })` accepts an optional
  `FakeInventoryClient` instance and overrides the real `InventoryClient`
  provider with it — needed by any spec that exercises
  `/admin/inventory/:productId`, since `apps/inventory` has no host port
  published and is unreachable from the host-side Jest process. Omitting the
  option leaves every other spec's app wired to the real provider unchanged.
- `test/support/response-types.ts` — typed envelope shapes reused across
  specs (reuses the real `ProductOutput`/`CategoryOutput`/`ProfileOutput`
  types from `src/`, so assertions stay honest about the actual API shape).
- `test/support/fixtures.ts` — `registerAndLoginCustomer()`,
  `loginAsAdmin()` (seeded admin credentials), `uniqueSuffix()`.
- `test/support/qstash-signing.ts` — `signQStashRequest()` builds an
  `Upstash-Signature` JWT (current signing key + destination URL fixed by
  `test-env.ts`) that reproduces the exact claims Upstash's real signer
  produces, so `events.e2e-spec.ts` can hand-sign `payment.completed`/
  `payment.failed` webhook payloads and have the running app's
  `QStashSignatureVerifier` accept them without any live Upstash dependency.
- `src/infrastructure/inventory/fake-inventory-client.ts` — `FakeInventoryClient`,
  an in-memory `InventoryClient` test double (mirrors the
  `FakeEventPublisher` pattern). `seed(productId, quantity)` preloads a known
  stock row; `getStock` returns `null` for an unseeded id, matching the real
  `HttpInventoryClient`'s 404-as-null contract; `setStock` upserts. Used by
  `admin.e2e-spec.ts` via `createTestApp({ fakeInventoryClient })`.

## Running locally

```bash
docker compose up -d --wait postgres redis
pnpm --filter api run test:e2e
```

No manual migration step is required — `test/global-setup.ts` handles it.
