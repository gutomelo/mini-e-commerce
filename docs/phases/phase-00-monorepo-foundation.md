# Phase 00 — Monorepo Foundation

- **Spec:** [pipeline design](../specs/2026-07-11-claude-code-pipeline-design.md)
- **Roadmap:** [ROADMAP.md](../ROADMAP.md)

## Objective

Set up the Turborepo monorepo with pnpm workspaces, shared tooling (lint, format, git hooks, commit conventions), and placeholder shared packages, so every later phase builds on a consistent foundation. No application code in this phase.

## Prerequisites

- [x] Claude Code build pipeline is committed (spec, skills, agents, hooks)
- [x] Spec for this phase is `Approved`

## Tasks

- [x] Initialize pnpm workspace: root `package.json` (private, engines, scripts) and `pnpm-workspace.yaml` covering `apps/*` and `packages/*` (owner: main)
- [x] Add `turbo.json` with `build`, `dev`, `lint`, `test` pipelines and sensible caching (owner: main)
- [x] Create `packages/config`: shared ESLint, Prettier, and TypeScript configs consumed by all TS apps (owner: main)
- [x] Create `packages/types`: placeholder package for shared DTO/event types with `tsconfig` and build script (owner: main)
- [x] Create `packages/shared`: placeholder package for shared utilities (owner: main)
- [x] Create `packages/ui`: placeholder package for shared React UI components (owner: nextjs-developer)
- [x] Add `.editorconfig` at the root (owner: main)
- [x] Set up Husky + lint-staged: pre-commit runs lint-staged (Prettier on staged files; ESLint stays in `turbo lint` to keep commits fast) (owner: main)
- [x] Set up commitlint with the Conventional Commits config and a `commit-msg` hook (owner: main)
- [x] Add root `.env.example` documenting shared environment variables (owner: main)
- [x] Update `.gitignore` for node_modules, dist, .turbo, coverage, and real `.env` files (owner: main)
- [x] Update root `README.md`: monorepo structure, services, technologies, development workflow (owner: main)

## Acceptance Criteria

- A fresh clone with pnpm installed can run install, lint, and build without errors.
- All shared packages compile (even as placeholders) through Turborepo.
- A commit with a non-conventional message is rejected by commitlint.
- No real secrets exist in the repository; only `.env.example`.

## Verification

- [x] `pnpm install` — completes without errors
- [x] `pnpm turbo run lint` — passes for all packages
- [x] `pnpm turbo run build` — passes for all packages
- [x] `echo "bad message" | pnpm exec commitlint` — exits non-zero (rejected)
- [x] `echo "feat: verify commitlint" | pnpm exec commitlint` — exits zero (accepted)
- [x] `test -f .husky/pre-commit && test -f .husky/commit-msg` — both git hooks exist
- [x] `test -f .env.example && ! test -f .env` — example env exists, no real env committed
