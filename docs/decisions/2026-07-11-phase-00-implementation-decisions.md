# Phase 00 Implementation Decisions

Decisions made during Phase 00 (Monorepo Foundation) implementation and its code review, recorded so later phases inherit them explicitly.

## 1. Event envelope payload field is `data` (not `payload`)

`.claude/rules/rules-global.md` originally listed the event fields as `event, timestamp, correlationId, payload`, while the project brief's JSON example, the spec template, and `packages/types` all use `data`. The code review flagged the contradiction as a contract defect. **Resolution:** `data` wins — it matches the concrete JSON contract in the original project brief and the implemented `EventEnvelope<TData>`. The rules file was amended accordingly. Every producer/consumer (NestJS, Go, Spring Boot) must map the envelope as `event, correlationId, timestamp, data`.

## 2. Pre-commit runs Prettier only; ESLint stays in `turbo lint`

The original checklist wording said pre-commit would run "Prettier + ESLint on staged files". Running ESLint per staged file across five heterogeneous packages makes commits slow and duplicates what `pnpm lint` (Turborepo, cached) already does. **Resolution:** lint-staged formats with Prettier only; ESLint runs via `turbo lint` locally and in the phase verification gate.

## 3. TypeScript pinned to 5.9.x workspace-wide

typescript-eslint 8.x crashes with TypeScript >= 6 (pnpm resolved 7.0.2 as latest). **Resolution:** `pnpm-workspace.yaml` sets `overrides: typescript: ^5.9.3`, and `@mini-e-commerce/config` declares `typescript@^5.9.3` so peer resolution binds the toolchain to the 5.x line. Revisit when typescript-eslint supports TS >= 6.

## 4. Shared utilities must be runtime-neutral

`@mini-e-commerce/shared` is consumed by Node services and potentially browser bundles. **Resolution:** use Web Crypto (`globalThis.crypto.randomUUID()`) instead of `node:crypto`; keep future shared utilities free of Node-only imports, and pin `@types/node` to the engines line (`^22`).
