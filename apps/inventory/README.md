# inventory — Serviço de Estoque em Go

🇧🇷 [Português (Brasil)](#português-brasil) · 🇺🇸 [English (US)](#english-us)

---

## Português (Brasil)

Dono do bounded context de estoque: uma contagem de estoque por produto apoiada no Postgres, uma pequena API REST interna para consultar/corrigir estoque, e integração de eventos via QStash — um consumidor idempotente de `order.created` que decrementa o estoque e um publicador de `inventory.updated`. Biblioteca padrão mais `pgx`, `golang-migrate`, e o SDK oficial `qstash-go` (somente verificação de assinatura) — sem framework web, sem ORM. Serviço interno, nunca exposto através do proxy reverso; toda rota que não seja de health exige um segredo compartilhado.

### Rodando localmente

```bash
docker compose up -d --wait postgres api   # postgres para o próprio banco; api para a consulta de slug do comando de seed
pnpm turbo run dev --filter=inventory      # http://localhost:8081 (go run ./cmd/server)
```

Migrações e seed não são automáticos fora do container — rode-os você mesmo primeiro:

```bash
INVENTORY_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/mini_ecommerce_inventory go run ./cmd/migrate
API_BASE_URL=http://localhost:3001 INVENTORY_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/mini_ecommerce_inventory go run ./cmd/seed
```

A imagem Docker do `inventory` roda ambos automaticamente ao iniciar o container (veja `docker-entrypoint.sh`), no mesmo padrão do `apps/api`.

### Health

`GET /health` → `{"status":"ok","service":"inventory"}` (sem autenticação).

### API REST interna

Toda rota abaixo exige `X-Internal-Api-Key` (comparado em tempo constante). Não é alcançável fora da rede do Compose — nenhuma porta do host é publicada.

- `GET /internal/v1/stock/:productId` → `200 { "productId", "quantity", "updatedAt" }`, ou `404` se desconhecido. `400` para um id malformado (não-UUID).
- `PATCH /internal/v1/stock/:productId` — corpo `{ "quantity": N }` (inteiro, `>= 0`) define uma quantidade absoluta, criando a linha se ela não existir. `400` para um corpo negativo/não inteiro.

Ambas as rotas aceitam um header `X-Correlation-Id` de entrada (gerando um se ausente) e o ecoam de volta na resposta; o valor aparece em toda linha de `slog` daquela requisição, seguindo a mesma disciplina de correlation id que o `apps/api` já aplica a toda requisição e que o próprio caminho de eventos QStash deste serviço já aplica via o envelope do evento. O `HttpInventoryClient` interno do `apps/api` encaminha seu próprio correlation id atual em toda chamada feita aqui.

### Integração de eventos via QStash

- **Consome** `order.created`: `POST /internal/v1/events/qstash` verifica o header `Upstash-Signature` (via o SDK oficial `qstash-go`, checado contra tanto a chave de assinatura atual quanto a próxima) antes de sequer analisar o corpo — uma assinatura inválida nunca chega à lógica de decremento. Decrementa o estoque por item de linha, limitado em zero (nunca negativo; um produto desconhecido é tratado como partindo de zero em vez de dar erro no evento inteiro). Idempotente: uma tabela `processed_events` indexada pelo `correlationId` do evento torna uma reentrega do mesmo evento pelo QStash um no-op.
- **Publica** `inventory.updated` (um evento por produto cujo estoque mudou) através de uma porta `EventPublisher`. Duas implementações: `internal/infrastructure/fake` (gravador em memória, o padrão, para que toda verificação automatizada nunca dependa de um round-trip real com a Upstash) e `internal/infrastructure/qstash` (o cliente HTTP real da Upstash). `EVENT_PUBLISHER_MODE=real` alterna a conexão do `cmd/server` para o adapter real (padrão `fake` para qualquer outro valor).
- Como o `apps/api` só publica `order.created` em uma fase posterior, este consumidor é comprovado com requisições de teste montadas e assinadas manualmente (veja `internal/presentation/http/integration_test.go`), em vez de um produtor real ou um round-trip real com a Upstash.

### Variáveis de ambiente

Veja o `.env.example` da raiz para os valores padrão. O compose fornece valores locais seguros automaticamente.

- `PORT` — porta HTTP (padrão `8081`).
- `INVENTORY_DATABASE_URL` — string de conexão do Postgres para o próprio banco `mini_ecommerce_inventory` deste serviço (um banco separado na mesma instância do Postgres do `mini_ecommerce` do `apps/api`, não um schema compartilhado).
- `INTERNAL_API_KEY` — segredo compartilhado exigido em toda rota exceto `/health`.
- `API_BASE_URL` — URL base da API NestJS; usada apenas pelo `cmd/seed` para resolver slugs de produtos em ids.
- `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` — usadas para verificar assinaturas de webhook do QStash de entrada (ambas aceitas, já que o QStash rotaciona as chaves).
- `QSTASH_TOKEN` — token de portador para o publicador real do QStash.
- `QSTASH_DESTINATION_URL` — a URL externa completa para a qual o QStash foi configurado a entregar o webhook; precisa bater exatamente com o que o QStash assinou.
- `EVENT_PUBLISHER_MODE` — `fake` (padrão) conecta o publicador em memória usado por toda verificação automatizada; `real` conecta o publicador real do QStash acima. Qualquer valor diferente de exatamente `real` cai de volta para `fake`.

### Migrações e seed

```bash
go run ./cmd/migrate   # idempotente: cria o banco se estiver ausente, aplica migrações pendentes
go run ./cmd/seed      # idempotente: faz upsert de uma quantidade inicial de estoque para cada produto semeado conhecido
```

O `cmd/migrate` conecta ao banco de manutenção `postgres` para criar `mini_ecommerce_inventory` caso ele ainda não exista (o Postgres não tem `CREATE DATABASE IF NOT EXISTS`), depois aplica toda migração do `golang-migrate` sob `migrations/` (embutida no binário via `go:embed`, então nenhuma cópia separada de arquivo é necessária em runtime).

O `cmd/seed` resolve cada um dos 12 slugs de produto do catálogo conhecido para o id de produto gerado dinamicamente pelo `apps/api`, chamando seu endpoint público `GET /api/v1/products` (ids não são fixos entre volumes de banco novos, só os slugs são), depois faz upsert de uma quantidade de estoque padrão por produto resolvido. Um slug que o apps/api ainda não semeou é ignorado com um aviso, não uma falha total.

### Testes

```bash
go test ./...                                          # testes unitários (sem banco de dados necessário)
INVENTORY_DATABASE_URL=... go test ./...                # também roda os testes de integração apoiados em Postgres
```

Os testes apoiados em Postgres (round-trips de repositório, e a suite completa em nível de handler HTTP em `internal/presentation/http/integration_test.go`) são condicionados a `INVENTORY_DATABASE_URL` estar definida — eles pulam de forma limpa, não falham, quando nenhum banco de teste está configurado, então `pnpm turbo run test` nunca exige Postgres para passar. Cada teste gera seus próprios ids UUID aleatórios em vez de depender de um passo de reset compartilhado, então as execuções permanecem independentes e reexecuções são idempotentes.

### Docker

`docker compose build inventory`. Somente interno: alcançável como `http://inventory:8081` dentro da rede do Compose; sem porta do host.

---

## English (US)

Owns the stock bounded context: a Postgres-backed stock count per product, a small internal REST API for querying/correcting stock, and QStash event integration — an idempotent `order.created` consumer that decrements stock and an `inventory.updated` publisher. Standard library plus `pgx`, `golang-migrate`, and the official `qstash-go` SDK (signature verification only) — no web framework, no ORM. Internal service, never exposed through the reverse proxy; every non-health route requires a shared secret.

### Run locally

```bash
docker compose up -d --wait postgres api   # postgres for its own DB; api for the seed command's slug lookup
pnpm turbo run dev --filter=inventory      # http://localhost:8081 (go run ./cmd/server)
```

Migrations and seeding aren't automatic outside the container — run them yourself first:

```bash
INVENTORY_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/mini_ecommerce_inventory go run ./cmd/migrate
API_BASE_URL=http://localhost:3001 INVENTORY_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/mini_ecommerce_inventory go run ./cmd/seed
```

The `inventory` Docker image runs both automatically on container start (see `docker-entrypoint.sh`), same pattern as `apps/api`.

### Health

`GET /health` → `{"status":"ok","service":"inventory"}` (unauthenticated).

### Internal REST API

Every route below requires `X-Internal-Api-Key` (compared in constant time). Not reachable outside the Compose network — no host port is published.

- `GET /internal/v1/stock/:productId` → `200 { "productId", "quantity", "updatedAt" }`, or `404` if unknown. `400` on a malformed (non-UUID) id.
- `PATCH /internal/v1/stock/:productId` — body `{ "quantity": N }` (integer, `>= 0`) sets an absolute quantity, creating the row if it doesn't exist. `400` on a negative/non-integer body.

Both routes accept an inbound `X-Correlation-Id` header (generating one if absent) and echo it back on the response; the value appears in every `slog` line for that request, matching the correlation-id discipline `apps/api` already applies to every request and this service's own QStash event path already applies via the event envelope. `apps/api`'s internal `HttpInventoryClient` forwards its own current correlation id on every call here.

### QStash event integration

- **Consumes** `order.created`: `POST /internal/v1/events/qstash` verifies the `Upstash-Signature` header (via the official `qstash-go` SDK, checked against both the current and next signing key) before ever parsing the body — an invalid signature never reaches the decrement logic. Decrements stock per line item, clamped at zero (never negative; an unknown product is treated as starting from zero rather than erroring the whole event). Idempotent: a `processed_events` table keyed by the event's `correlationId` makes a QStash redelivery of the same event a no-op.
- **Publishes** `inventory.updated` (one event per product whose stock changed) through an `EventPublisher` port. Two implementations: `internal/infrastructure/fake` (in-memory recorder, the default so every automated check never depends on a live Upstash round-trip) and `internal/infrastructure/qstash` (the real Upstash HTTP client). `EVENT_PUBLISHER_MODE=real` switches `cmd/server`'s wiring to the real adapter (default `fake` for any other value).
- Since `apps/api` doesn't publish `order.created` until a later phase, this consumer is proven with hand-crafted, hand-signed test requests (see `internal/presentation/http/integration_test.go`) rather than a live producer or a real Upstash round-trip.

### Environment variables

See the root `.env.example` for defaults. Compose provides safe local values automatically.

- `PORT` — HTTP port (default `8081`).
- `INVENTORY_DATABASE_URL` — Postgres connection string for this service's own `mini_ecommerce_inventory` database (a separate database on the same Postgres instance as `apps/api`'s `mini_ecommerce`, not a shared schema).
- `INTERNAL_API_KEY` — shared secret required on every route except `/health`.
- `API_BASE_URL` — base URL of the NestJS API; used only by `cmd/seed` to resolve product slugs to ids.
- `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` — used to verify inbound QStash webhook signatures (both are accepted, since QStash rotates keys).
- `QSTASH_TOKEN` — bearer token for the real QStash publisher.
- `QSTASH_DESTINATION_URL` — the full external URL QStash was told to deliver the webhook to; must match exactly what QStash signed.
- `EVENT_PUBLISHER_MODE` — `fake` (default) wires the in-memory publisher used by every automated check; `real` wires the real QStash publisher above. Any value other than exactly `real` falls back to `fake`.

### Migrations and seeding

```bash
go run ./cmd/migrate   # idempotent: creates the database if missing, applies pending migrations
go run ./cmd/seed      # idempotent: upserts a starting stock quantity for every known seeded product
```

`cmd/migrate` connects to the `postgres` maintenance database to create `mini_ecommerce_inventory` if it doesn't exist yet (Postgres has no `CREATE DATABASE IF NOT EXISTS`), then applies every `golang-migrate` migration under `migrations/` (embedded into the binary via `go:embed`, so no separate file copy is needed at runtime).

`cmd/seed` resolves each of the 12 known catalog product slugs to `apps/api`'s dynamically-generated product id by calling its public `GET /api/v1/products` endpoint (ids aren't fixed across fresh database volumes, only slugs are), then upserts a default stock quantity per resolved product. A slug apps/api hasn't seeded yet is skipped with a warning, not a hard failure.

### Testing

```bash
go test ./...                                          # unit tests (no database required)
INVENTORY_DATABASE_URL=... go test ./...                # also runs Postgres-backed integration tests
```

Postgres-backed tests (repository round-trips, and the full HTTP-handler-level suite in `internal/presentation/http/integration_test.go`) are gated on `INVENTORY_DATABASE_URL` being set — they skip cleanly, not fail, when no test database is configured, so `pnpm turbo run test` never requires Postgres to pass. Each test generates its own random UUID ids rather than relying on a shared reset step, so runs stay independent and reruns are idempotent.

### Docker

`docker compose build inventory`. Internal-only: reachable as `http://inventory:8081` inside the Compose network; no host port.
