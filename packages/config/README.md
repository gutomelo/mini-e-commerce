# @mini-e-commerce/config

🇧🇷 [Português (Brasil)](#português-brasil) · 🇺🇸 [English (US)](#english-us)

---

## Português (Brasil)

Configurações compartilhadas de ESLint, Prettier, e TypeScript para as aplicações TypeScript do monorepo (`apps/web`, `apps/admin`, `apps/api`, e os demais pacotes de `packages/`). Um pacote puramente de configuração — sem código de runtime, sem build próprio.

### Conteúdo

```text
eslint/base.mjs        # config base do ESLint (flat config), construída sobre @eslint/js + typescript-eslint
prettier/index.mjs      # config compartilhada do Prettier
typescript/base.json    # tsconfig.json base para extends
```

### Exports

```js
import config from '@mini-e-commerce/config/eslint';
import prettierConfig from '@mini-e-commerce/config/prettier';
```

```json
{ "extends": "@mini-e-commerce/config/typescript" }
```

### Uso

Cada app/pacote consumidor declara `@mini-e-commerce/config` como `devDependency` (`workspace:*`) e estende esses arquivos em seu próprio `eslint.config.mjs`/`tsconfig.json`, em vez de duplicar regras de lint ou opções do compilador.

---

## English (US)

Shared ESLint, Prettier, and TypeScript configurations for the monorepo's TypeScript apps (`apps/web`, `apps/admin`, `apps/api`, and the other packages under `packages/`). A pure configuration package — no runtime code, no build step of its own.

### Contents

```text
eslint/base.mjs        # base ESLint config (flat config), built on @eslint/js + typescript-eslint
prettier/index.mjs      # shared Prettier config
typescript/base.json    # base tsconfig.json to extend
```

### Exports

```js
import config from '@mini-e-commerce/config/eslint';
import prettierConfig from '@mini-e-commerce/config/prettier';
```

```json
{ "extends": "@mini-e-commerce/config/typescript" }
```

### Usage

Each consuming app/package declares `@mini-e-commerce/config` as a `devDependency` (`workspace:*`) and extends these files in its own `eslint.config.mjs`/`tsconfig.json`, instead of duplicating lint rules or compiler options.
