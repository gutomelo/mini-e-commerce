# Phase 00 — Monorepo Foundation

- **Spec:** [pipeline design](../specs/2026-07-11-claude-code-pipeline-design.md)
- **Roadmap:** [ROADMAP.md](../ROADMAP.md)

## Objective

Set up the Turborepo monorepo with pnpm workspaces, shared tooling (lint, format, git hooks, commit conventions), and placeholder shared packages, so every later phase builds on a consistent foundation. No application code in this phase.

## Prerequisites

- [ ] Claude Code build pipeline is committed (spec, skills, agents, hooks)
- [ ] Spec for this phase is `Approved`

## Tasks

- [ ] Initialize pnpm workspace: root `package.json` (private, engines, scripts) and `pnpm-workspace.yaml` covering `apps/*` and `packages/*` (owner: main)
- [ ] Add `turbo.json` with `build`, `dev`, `lint`, `test` pipelines and sensible caching (owner: main)
- [ ] Create `packages/config`: shared ESLint, Prettier, and TypeScript configs consumed by all TS apps (owner: main)
- [ ] Create `packages/types`: placeholder package for shared DTO/event types with `tsconfig` and build script (owner: main)
- [ ] Create `packages/shared`: placeholder package for shared utilities (owner: main)
- [ ] Create `packages/ui`: placeholder package for shared React UI components (owner: nextjs-developer)
- [ ] Add `.editorconfig` at the root (owner: main)
- [ ] Set up Husky + lint-staged: pre-commit runs lint-staged (Prettier + ESLint on staged files) (owner: main)
- [ ] Set up commitlint with the Conventional Commits config and a `commit-msg` hook (owner: main)
- [ ] Add root `.env.example` documenting shared environment variables (owner: main)
- [ ] Update `.gitignore` for node_modules, dist, .turbo, coverage, and real `.env` files (owner: main)
- [ ] Update root `README.md`: monorepo structure, services, technologies, development workflow (owner: main)

## Acceptance Criteria

- A fresh clone with pnpm installed can run install, lint, and build without errors.
- All shared packages compile (even as placeholders) through Turborepo.
- A commit with a non-conventional message is rejected by commitlint.
- No real secrets exist in the repository; only `.env.example`.

## Verification

- [ ] `pnpm install` — completes without errors
- [ ] `pnpm turbo run lint` — passes for all packages
- [ ] `pnpm turbo run build` — passes for all packages
- [ ] `echo "bad message" | pnpm exec commitlint` — exits non-zero (rejected)
- [ ] `echo "feat: verify commitlint" | pnpm exec commitlint` — exits zero (accepted)
- [ ] `test -f .husky/pre-commit && test -f .husky/commit-msg` — both git hooks exist
- [ ] `test -f .env.example && ! test -f .env` — example env exists, no real env committed
