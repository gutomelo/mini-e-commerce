# Spec: Claude Code AI Build Pipeline

- **Date:** 2026-07-11
- **Status:** Approved
- **Phase:** n/a (pipeline setup, precedes Phase 0)

## Overview

Before any application code is written, the Mini E-Commerce monorepo gets a complete Claude Code build pipeline: spec-driven workflow skills, stack-specialist subagents, enforcement hooks, and a phase checklist system with blocking verification gates. The pipeline makes every implementation phase follow the same cycle — spec, plan, implement, verify — mirroring a professional engineering process.

## Goals

- A repeatable spec-driven workflow: `/create-spec` → `/plan-phase` → `/implement-phase` → `/verify-phase`, plus `/project-status` for visibility.
- A specialist subagent per stack (Next.js, Angular, NestJS, Go, Spring Boot) plus a read-only code reviewer, each loading its stack's best-practice skills and the project engineering rules.
- Automated enforcement through hooks: post-edit formatting, secrets protection, Conventional Commits validation, and per-session phase context injection.
- A 9-phase roadmap (walking skeleton first, then one phase per service) tracked in `docs/ROADMAP.md`, where a phase is `Done` only after automated verification passes.
- All artifacts authored in American English.

## Non-Goals

- No application code, Turborepo initialization, Dockerfiles, or infrastructure in this scope — that starts at Phase 0, after this pipeline is committed.
- No CI/CD configuration (GitHub Actions); may be introduced in Phase 8.
- No real payment gateway or production-grade secret management; the project is a portfolio demonstration.

## Architecture

Four cooperating parts, each with a single responsibility:

1. **Workflow skills** (`.claude/skills/`) — the process. Five skills, one per workflow step. `implement-phase` is the only orchestrator: it delegates stack-specific tasks to subagents and enforces the phase gate. `verify-phase` is the only writer of the `Done` status.
2. **Subagents** (`.claude/agents/`) — the roles. Five stack specialists that implement, one reviewer that only reads. Every agent prompt binds the agent to `.claude/rules/rules-global.md`, Clean Architecture layering, and American English.
3. **Hooks** (`.claude/hooks/` + `.claude/settings.json`) — the enforcement. Deterministic shell scripts that run regardless of model behavior: formatting after edits, blocking secret-file access, rejecting non-conventional commit messages, and injecting roadmap state at session start.
4. **Docs system** (`docs/`) — the state. `ROADMAP.md` is the single source of truth for phase status; `specs/` holds designs; `phases/` holds executable checklists; `templates/` keeps both document types consistent.

## Data & Contracts

- **Roadmap table row:** `| # | Phase | Spec | Checklist | Status |` with status in `Not Started | In Progress | Done`. Hooks and skills parse this table; its column order is a contract.
- **Phase checklist:** sections `Objective`, `Prerequisites`, `Tasks` (`- [ ]` items with `(owner: <agent>)`), `Acceptance Criteria`, `Verification` (`- [ ] \`command\` — expected result`). `/verify-phase` executes exactly the commands listed under Verification.
- **Spec document:** sections `Overview`, `Goals`, `Non-Goals`, `Architecture`, `Data & Contracts`, `Acceptance Criteria`, `Open Questions`. A spec is `Approved` only when Open Questions is empty or every item is explicitly deferred.
- **Hook contracts:** scripts read the Claude Code hook JSON payload from stdin; `PreToolUse` scripts block by exiting 2 with the reason on stderr; `SessionStart` output on stdout becomes session context. All scripts no-op gracefully when their toolchain is missing.

## Acceptance Criteria

- The five workflow skills exist under `.claude/skills/` with valid frontmatter and are invocable by name.
- The six agents exist under `.claude/agents/` with valid frontmatter; `code-reviewer` has read-only tools.
- The four hook scripts are executable, registered in `.claude/settings.json` (valid JSON), and behave as specified when fed sample payloads (secrets blocked, `.env.example` allowed, bad commit messages rejected, phase context printed).
- `docs/ROADMAP.md` lists all 9 phases with working links; `docs/phases/phase-00-monorepo-foundation.md` follows the template; both templates exist.
- `CLAUDE.md` documents the workflow, the gate rule, and the language policy.
- Everything is committed with Conventional Commit messages that pass the new commit hook.

## Open Questions

- **Fly.io deployment topology** (single container with a process supervisor vs. one Fly app per service): deferred to the Phase 8 spec, where the trade-offs will be evaluated against Fly.io's current features.
