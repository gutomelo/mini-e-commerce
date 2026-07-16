# @mini-e-commerce/ui

🇧🇷 [Português (Brasil)](#português-brasil) · 🇺🇸 [English (US)](#english-us)

---

## Português (Brasil)

Componentes de UI React compartilhados para os frontends do monorepo (hoje, `apps/web`; o `apps/admin` é Angular e não consome este pacote). Construído com Shadcn UI/Radix UI + Tailwind CSS v4, seguindo as regras de UI do projeto.

### Componentes

- `Button` — botão com variantes (`ButtonVariant`) e tamanhos (`ButtonSize`), via `class-variance-authority`.
- `Input` — campo de texto estilizado.
- `Label` — rótulo acessível (Radix `Label`).
- `ProductCard` — card de produto do catálogo (imagem, nome, preço).
- `CartBadge` — indicador de contagem de itens no carrinho.
- `Pagination` — controle de paginação para listagens.
- `cn`, `formatPriceCents` — utilitários (`src/lib/utils.ts`): `cn` mescla classes Tailwind (`clsx` + `tailwind-merge`); `formatPriceCents` formata um valor em centavos como moeda.

### Uso

```tsx
import { Button, ProductCard, cn } from '@mini-e-commerce/ui';
import '@mini-e-commerce/ui/globals.css';
```

`react` é uma `peerDependency` (`^19.0.0`) — o app consumidor deve fornecer sua própria instância do React, nunca duplicada por este pacote.

### Build

```bash
pnpm --filter @mini-e-commerce/ui build   # tsc, emite dist/
pnpm --filter @mini-e-commerce/ui lint
```

Novos componentes só devem ser adicionados aqui quando forem genuinamente reutilizáveis entre aplicações; componentes usados por uma única rota pertencem a `app/**/_components` daquele app, conforme as regras Next.js do projeto.

---

## English (US)

Shared React UI components for the monorepo's frontends (today, `apps/web`; `apps/admin` is Angular and doesn't consume this package). Built with Shadcn UI/Radix UI + Tailwind CSS v4, following the project's UI rules.

### Components

- `Button` — button with variants (`ButtonVariant`) and sizes (`ButtonSize`), via `class-variance-authority`.
- `Input` — styled text input.
- `Label` — accessible label (Radix `Label`).
- `ProductCard` — catalog product card (image, name, price).
- `CartBadge` — cart item-count indicator.
- `Pagination` — pagination control for listings.
- `cn`, `formatPriceCents` — utilities (`src/lib/utils.ts`): `cn` merges Tailwind classes (`clsx` + `tailwind-merge`); `formatPriceCents` formats a cents value as currency.

### Usage

```tsx
import { Button, ProductCard, cn } from '@mini-e-commerce/ui';
import '@mini-e-commerce/ui/globals.css';
```

`react` is a `peerDependency` (`^19.0.0`) — the consuming app must supply its own React instance, never duplicated by this package.

### Build

```bash
pnpm --filter @mini-e-commerce/ui build   # tsc, emits dist/
pnpm --filter @mini-e-commerce/ui lint
```

New components should only be added here when they're genuinely reusable across apps; components used by a single route belong in that app's `app/**/_components`, per the project's Next.js rules.
