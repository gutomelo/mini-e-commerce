# payment — Serviço de Pagamentos em Spring Boot

🇧🇷 [Português (Brasil)](#português-brasil) · 🇺🇸 [English (US)](#english-us)

---

## Português (Brasil)

Dono do bounded context de pagamentos: um registro apoiado no Postgres por pedido processado, um gateway de pagamento simulado, uma API REST interna para consultar o status do pagamento, e integração de eventos via QStash — um consumidor idempotente de `order.created` que publica `payment.completed` ou `payment.failed`. Java 21, Spring Boot, Maven, Spring Data JPA, Flyway. Serviço interno, nunca exposto através do proxy reverso; toda rota que não seja de health ou webhook exige um segredo compartilhado.

### Rodando localmente

Exige um JDK 21 (`JAVA_HOME` precisa apontar para um JDK, não um JRE):

```bash
docker compose up -d --wait postgres   # próprio banco na instância compartilhada do Postgres
./mvnw spring-boot:run                 # http://localhost:8082 (ou: pnpm turbo run dev --filter=payment)
```

O Flyway migra o schema automaticamente na inicialização — mas apenas se `mini_ecommerce_payment` já existir (o Flyway migra o schema dentro de um banco, ele não consegue criar o banco em si). Crie-o uma vez se estiver rodando fora do Docker:

```bash
docker compose exec postgres psql -U postgres -c "CREATE DATABASE mini_ecommerce_payment"
```

A imagem Docker trata isso automaticamente via `docker-entrypoint.sh` (um passo de checar-depois-criar baseado em `psql` antes da aplicação iniciar).

### Health

`GET /health` → `{"status":"ok","service":"payment"}` (sem autenticação). O Spring Actuator permanece em `/actuator/*`.

### API REST interna

Exige `X-Internal-Api-Key` (comparado em tempo constante). Não é alcançável fora da rede do Compose — nenhuma porta do host é publicada.

- `GET /internal/v1/payments/{orderId}` → `200 { "orderId", "status", "amountCents", "gatewayReference", "processedAt" }`, ou `404` se nenhum pagamento foi processado ainda para aquele pedido.

Essa rota aceita um header `X-Correlation-Id` de entrada (gerando um via `UUID.randomUUID()` se ausente) encadeado através do SLF4J MDC durante toda a duração da requisição e ecoado de volta na resposta — seguindo a mesma disciplina de correlation id que o `apps/api` já aplica a toda requisição e que o próprio caminho de eventos QStash deste serviço já aplica via o envelope do evento.

### Integração de eventos via QStash

- **Consome** `order.created`: `POST /internal/v1/events/qstash` verifica o header `Upstash-Signature` (baseado em JWT, via `jjwt`, checado contra tanto a chave de assinatura atual quanto a próxima) antes de o corpo ser sequer analisado — uma assinatura inválida nunca chega à lógica de processamento. Rejeita (`400`) qualquer valor de `event` diferente de `order.created`. Idempotente: uma tabela `processed_events` reivindica o `correlationId` do evento via um único `INSERT ... ON CONFLICT DO NOTHING` atômico, checado _antes_ de qualquer processamento de cobrança — uma reentrega do mesmo evento é um no-op, não uma cobrança duplicada. Um payload `order.created` para um `orderId` que já tem um pagamento (um `correlationId` diferente, o que não deveria acontecer na prática) é rejeitado com `409`, nunca uma exceção não tratada.
- **Gateway simulado**: aprova uma cobrança com uma taxa de sucesso configurável (`PAYMENT_GATEWAY_SUCCESS_RATE`, padrão `0.9`), exceto um valor sentinela reservado — exatamente **$666.00** (`totalCents == 66600`) — que sempre falha, independente da taxa configurada. Isso dá aos testes (e à exploração manual) uma forma determinística de exercitar o caminho de recusa.
- **Publica** `payment.completed` ou `payment.failed` (exatamente um por pedido processado) através de uma porta `EventPublisher`. Duas implementações: `InMemoryEventPublisher` (gravador em memória, o padrão, para que toda verificação automatizada nunca dependa de um round-trip real com a Upstash) e `QStashEventPublisher` (o cliente HTTP real da Upstash). `EVENT_PUBLISHER_MODE=real` alterna a conexão do `PaymentBeanConfiguration` para o adapter real (padrão `fake` para qualquer outro valor).
- Como o `apps/api` só publica `order.created` em uma fase posterior, este consumidor é comprovado com requisições de teste montadas e assinadas manualmente (veja `PaymentIntegrationTests`), em vez de um produtor real ou um round-trip real com a Upstash.

### Variáveis de ambiente

Veja o `.env.example` da raiz para os valores padrão. O compose fornece valores locais seguros automaticamente.

- `SERVER_PORT` — porta HTTP (padrão `8082`).
- `PAYMENT_DATABASE_URL` — URL JDBC para o próprio banco `mini_ecommerce_payment` deste serviço (um banco separado na mesma instância do Postgres do `mini_ecommerce` do `apps/api` e do `mini_ecommerce_inventory` do `apps/inventory`).
- `INTERNAL_API_KEY` — segredo compartilhado exigido no endpoint REST de pagamentos (mapeado no compose a partir de uma variável de host `PAYMENT_INTERNAL_API_KEY` distinta, para que o segredo do payment seja diferente do do inventory).
- `PAYMENT_GATEWAY_SUCCESS_RATE` — fração de cobranças simuladas aprovadas, excluindo o valor sentinela (padrão `0.9`).
- `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` — usadas para verificar assinaturas de webhook do QStash de entrada (ambas aceitas, já que o QStash rotaciona as chaves; mesma conta Upstash do `apps/inventory`).
- `QSTASH_TOKEN` — token de portador para o publicador real do QStash.
- `PAYMENT_QSTASH_DESTINATION_URL` — a URL externa completa para a qual o QStash foi configurado a entregar o webhook deste serviço; precisa bater exatamente com o que o QStash assinou. Distinta da própria URL de destino do `apps/inventory`.
- `EVENT_PUBLISHER_MODE` — `fake` (padrão) conecta o `InMemoryEventPublisher`, usado por toda verificação automatizada; `real` conecta o `QStashEventPublisher` real acima. Qualquer valor diferente de exatamente `real` cai de volta para `fake`.

### Testes

```bash
./mvnw test                              # testes unitários (sem banco de dados necessário)
PAYMENT_DATABASE_URL=... ./mvnw test      # também roda a suite de integração apoiada em Postgres
```

`PaymentIntegrationTests` é condicionada a `PAYMENT_DATABASE_URL` estar definida — ela pula de forma limpa, não falha, quando nenhum banco de teste está configurado, então `pnpm turbo run test` nunca exige Postgres para passar. Cada teste gera seus próprios ids aleatórios de pedido/correlação em vez de depender de um passo de reset compartilhado, então as execuções permanecem independentes e reexecuções são idempotentes.

### Docker

`docker compose build payment`. Somente interno: alcançável como `http://payment:8082` dentro da rede do Compose; sem porta do host.

---

## English (US)

Owns the payments bounded context: a Postgres-backed record per processed order, a simulated payment gateway, an internal REST API for querying payment status, and QStash event integration — an idempotent `order.created` consumer that publishes `payment.completed` or `payment.failed`. Java 21, Spring Boot, Maven, Spring Data JPA, Flyway. Internal service, never exposed through the reverse proxy; every non-health, non-webhook route requires a shared secret.

### Run locally

Requires a JDK 21 (`JAVA_HOME` must point at a JDK, not a JRE):

```bash
docker compose up -d --wait postgres   # its own database on the shared Postgres instance
./mvnw spring-boot:run                 # http://localhost:8082 (or: pnpm turbo run dev --filter=payment)
```

Flyway migrates the schema automatically on startup — but only if `mini_ecommerce_payment` already exists (Flyway migrates schema within a database, it cannot create the database itself). Create it once if running outside Docker:

```bash
docker compose exec postgres psql -U postgres -c "CREATE DATABASE mini_ecommerce_payment"
```

The Docker image handles this automatically via `docker-entrypoint.sh` (a `psql`-based check-then-create step before the app starts).

### Health

`GET /health` → `{"status":"ok","service":"payment"}` (unauthenticated). Spring Actuator stays at `/actuator/*`.

### Internal REST API

Requires `X-Internal-Api-Key` (compared in constant time). Not reachable outside the Compose network — no host port is published.

- `GET /internal/v1/payments/{orderId}` → `200 { "orderId", "status", "amountCents", "gatewayReference", "processedAt" }`, or `404` if no payment has been processed for that order yet.

This route accepts an inbound `X-Correlation-Id` header (generating one via `UUID.randomUUID()` if absent) threaded through SLF4J MDC for the request's duration and echoed back on the response — matching the correlation-id discipline `apps/api` already applies to every request and this service's own QStash event path already applies via the event envelope.

### QStash event integration

- **Consumes** `order.created`: `POST /internal/v1/events/qstash` verifies the `Upstash-Signature` header (JWT-based, via `jjwt`, checked against both the current and next signing key) before the body is ever parsed — an invalid signature never reaches the processing logic. Rejects (`400`) any `event` value other than `order.created`. Idempotent: a `processed_events` table claims the event's `correlationId` via a single atomic `INSERT ... ON CONFLICT DO NOTHING`, checked _before_ any charge processing — a redelivery of the same event is a no-op, not a double charge. An `order.created` payload for an `orderId` that already has a payment (a different `correlationId`, which shouldn't happen in practice) is rejected with `409`, never an unhandled exception.
- **Simulated gateway**: approves a charge with a configurable success rate (`PAYMENT_GATEWAY_SUCCESS_RATE`, default `0.9`), except a reserved sentinel amount — exactly **$666.00** (`totalCents == 66600`) — which always fails, regardless of the configured rate. This gives tests (and manual exploration) a deterministic way to exercise the decline path.
- **Publishes** `payment.completed` or `payment.failed` (exactly one per processed order) through an `EventPublisher` port. Two implementations: `InMemoryEventPublisher` (in-memory recorder, the default so every automated check never depends on a live Upstash round-trip) and `QStashEventPublisher` (the real Upstash HTTP client). `EVENT_PUBLISHER_MODE=real` switches `PaymentBeanConfiguration`'s wiring to the real adapter (default `fake` for any other value).
- Since `apps/api` doesn't publish `order.created` until a later phase, this consumer is proven with hand-crafted, hand-signed test requests (see `PaymentIntegrationTests`) rather than a live producer or a real Upstash round-trip.

### Environment variables

See the root `.env.example` for defaults. Compose provides safe local values automatically.

- `SERVER_PORT` — HTTP port (default `8082`).
- `PAYMENT_DATABASE_URL` — JDBC URL for this service's own `mini_ecommerce_payment` database (a separate database on the same Postgres instance as `apps/api`'s `mini_ecommerce` and `apps/inventory`'s `mini_ecommerce_inventory`).
- `INTERNAL_API_KEY` — shared secret required on the payments REST endpoint (mapped in compose from a distinct `PAYMENT_INTERNAL_API_KEY` host variable, so payment's secret differs from inventory's).
- `PAYMENT_GATEWAY_SUCCESS_RATE` — fraction of simulated charges approved, excluding the sentinel amount (default `0.9`).
- `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` — used to verify inbound QStash webhook signatures (both accepted, since QStash rotates keys; same Upstash account as `apps/inventory`).
- `QSTASH_TOKEN` — bearer token for the real QStash publisher.
- `PAYMENT_QSTASH_DESTINATION_URL` — the full external URL QStash was told to deliver this service's webhook to; must match exactly what QStash signed. Distinct from `apps/inventory`'s own destination URL.
- `EVENT_PUBLISHER_MODE` — `fake` (default) wires `InMemoryEventPublisher`, used by every automated check; `real` wires the real `QStashEventPublisher` above. Any value other than exactly `real` falls back to `fake`.

### Testing

```bash
./mvnw test                              # unit tests (no database required)
PAYMENT_DATABASE_URL=... ./mvnw test      # also runs the Postgres-backed integration suite
```

`PaymentIntegrationTests` is gated on `PAYMENT_DATABASE_URL` being set — it skips cleanly, not fails, when no test database is configured, so `pnpm turbo run test` never requires Postgres to pass. Every test generates its own random order/correlation ids rather than relying on a shared reset step, so runs stay independent and reruns are idempotent.

### Docker

`docker compose build payment`. Internal-only: reachable as `http://payment:8082` inside the Compose network; no host port.
