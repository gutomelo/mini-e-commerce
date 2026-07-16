# @mini-e-commerce/shared

🇧🇷 [Português (Brasil)](#português-brasil) · 🇺🇸 [English (US)](#english-us)

---

## Português (Brasil)

Utilitários compartilhados entre os serviços TypeScript do monorepo (`apps/web`, `apps/admin`, `apps/api`): geração de correlation id e construção do envelope de eventos. Depende de `@mini-e-commerce/types` para os formatos de contrato.

### API

- `newCorrelationId(): string` — gera um correlation id usando a Web Crypto API (`crypto.randomUUID()`), funcionando tanto em Node.js quanto no navegador.
- `createEventEnvelope<TData>(event: EventName, data: TData, correlationId?: string): EventEnvelope<TData>` — monta o envelope padrão de evento publicado no QStash (`event`, `correlationId`, `timestamp`, `data`). Reutiliza um `correlationId` de entrada quando o evento pertence a um trace já existente; gera um novo via `newCorrelationId()` quando omitido.

### Uso

```ts
import { newCorrelationId, createEventEnvelope } from '@mini-e-commerce/shared';
import { EVENT_NAMES } from '@mini-e-commerce/types';

const envelope = createEventEnvelope(EVENT_NAMES.ORDER_CREATED, { orderId, totalCents, items });
```

Go (`apps/inventory`) e Java (`apps/payment`) reproduzem essa mesma lógica de geração de correlation id/envelope de forma independente em suas próprias linguagens, já que não conseguem importar um pacote TypeScript diretamente.

---

## English (US)

Shared utilities across the monorepo's TypeScript services (`apps/web`, `apps/admin`, `apps/api`): correlation-id generation and event-envelope construction. Depends on `@mini-e-commerce/types` for the contract shapes.

### API

- `newCorrelationId(): string` — generates a correlation id using the Web Crypto API (`crypto.randomUUID()`), working on both Node.js and browser runtimes.
- `createEventEnvelope<TData>(event: EventName, data: TData, correlationId?: string): EventEnvelope<TData>` — builds the standard event envelope published to QStash (`event`, `correlationId`, `timestamp`, `data`). Reuses an incoming `correlationId` when the event belongs to an existing trace; generates a new one via `newCorrelationId()` when omitted.

### Usage

```ts
import { newCorrelationId, createEventEnvelope } from '@mini-e-commerce/shared';
import { EVENT_NAMES } from '@mini-e-commerce/types';

const envelope = createEventEnvelope(EVENT_NAMES.ORDER_CREATED, { orderId, totalCents, items });
```

Go (`apps/inventory`) and Java (`apps/payment`) reproduce this same correlation-id/envelope generation logic independently in their own languages, since they can't import a TypeScript package directly.
