# @mini-e-commerce/types

🇧🇷 [Português (Brasil)](#português-brasil) · 🇺🇸 [English (US)](#english-us)

---

## Português (Brasil)

Tipos DTO e de contrato de eventos compartilhados entre os serviços TypeScript do monorepo (`apps/web`, `apps/admin`, `apps/api`). Um pacote puramente de tipos — sem lógica de runtime além das constantes de nomes de evento abaixo.

### Conteúdo

- `src/api.ts` — formatos de DTO/resposta compartilhados entre a API e seus consumidores.
- `src/index.ts` — reexporta `api.ts` e define o contrato de eventos:
  - `EVENT_NAMES` — os nomes canônicos de evento publicados via QStash (`order.created`, `inventory.updated`, `payment.completed`, `payment.failed`, `product.updated`). Todo serviço deve referenciar essas constantes em vez de strings soltas.
  - `EventName` — union type derivada de `EVENT_NAMES`.
  - `EventEnvelope<TData>` — o formato padrão de envelope (`event`, `correlationId`, `timestamp`, `data`) usado em toda troca de eventos entre serviços (veja o `createEventEnvelope` de `@mini-e-commerce/shared`, que constrói esse formato).

### Uso

```ts
import { EVENT_NAMES, type EventEnvelope } from '@mini-e-commerce/types';
```

Só o Go (`apps/inventory`) e o Java (`apps/payment`) não conseguem importar este pacote diretamente — eles reproduzem o mesmo contrato de envelope em suas próprias linguagens, mantido em sincronia manualmente com este arquivo.

---

## English (US)

Shared DTO and event contract types across the monorepo's TypeScript services (`apps/web`, `apps/admin`, `apps/api`). A pure types package — no runtime logic beyond the event-name constants below.

### Contents

- `src/api.ts` — DTO/response shapes shared between the API and its consumers.
- `src/index.ts` — re-exports `api.ts` and defines the event contract:
  - `EVENT_NAMES` — the canonical event names published through QStash (`order.created`, `inventory.updated`, `payment.completed`, `payment.failed`, `product.updated`). Every service must reference these constants instead of raw strings.
  - `EventName` — union type derived from `EVENT_NAMES`.
  - `EventEnvelope<TData>` — the standard envelope shape (`event`, `correlationId`, `timestamp`, `data`) used for every event exchanged between services (see `@mini-e-commerce/shared`'s `createEventEnvelope`, which builds this shape).

### Usage

```ts
import { EVENT_NAMES, type EventEnvelope } from '@mini-e-commerce/types';
```

Only Go (`apps/inventory`) and Java (`apps/payment`) can't import this package directly — they reproduce the same envelope contract in their own languages, kept in sync with this file by hand.
