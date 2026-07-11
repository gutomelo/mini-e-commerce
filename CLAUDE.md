# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Mini E-Commerce — a portfolio monorepo (Turborepo + pnpm) demonstrating Clean Architecture and event-driven design across five apps: `web` (Next.js storefront), `admin` (Angular), `api` (NestJS Gateway/BFF), `inventory` (Go), `payment` (Spring Boot), backed by PostgreSQL, Upstash Redis, and Upstash QStash. Engineering rules live in `.claude/rules/rules-global.md` and are binding.

## Language policy

All code, comments, documentation, commit messages, and identifiers are written in American English — no Portuguese in any artifact.

## Build workflow (spec-driven, phase-gated)

Work advances through the 9 phases in `docs/ROADMAP.md` using four steps, each a skill:

1. `/create-spec` — brainstorm and write a spec to `docs/specs/` (template: `docs/templates/spec-template.md`).
2. `/plan-phase <N>` — turn the approved spec into a checklist at `docs/phases/phase-NN-*.md` with tasks, owners, and verification commands.
3. `/implement-phase <N>` — execute the checklist, delegating stack tasks to the specialist agents. Refuses to start if the previous phase is not `Done`.
4. `/verify-phase <N>` — run every Verification command; only this skill may mark a phase `Done` in the roadmap.

`/project-status` shows where the project stands and the next command. `docs/ROADMAP.md` is the single source of truth for phase status — never edit its Status column by hand.

## Agents

Stack specialists in `.claude/agents/`: `nextjs-developer`, `angular-developer`, `nestjs-developer`, `go-developer`, `spring-developer`, plus read-only `code-reviewer`. Delegate stack-specific implementation to the matching agent; review every phase's diff with `code-reviewer` before verification.

## Hooks

Registered in `.claude/settings.json` (scripts in `.claude/hooks/`): post-edit auto-formatting, secrets protection (`.env*`, keys — `.env.example` allowed), Conventional Commits validation, and roadmap context injection at session start.

