---
name: plan-phase
description: Turn an approved spec into an executable phase checklist for the Mini E-Commerce roadmap. Use after a spec is approved or when the user asks to plan a phase (e.g. /plan-phase 2). Produces docs/phases/phase-NN-<name>.md with tasks, acceptance criteria, and verification commands.
---

# Plan Phase

Convert an approved spec into the phase checklist that `/implement-phase` executes and `/verify-phase` gates. Planning only — no implementation.

## Inputs

- Phase number (from the argument, e.g. `/plan-phase 2`). If missing, use the first phase in `docs/ROADMAP.md` that has an approved spec but no checklist, and confirm with the user.

## Hard rules

- The phase's spec must exist and be `Approved`. If not, stop and suggest `/create-spec` first.
- Do NOT write application code or config while planning.
- Write in American English.

## Process

1. Read `docs/ROADMAP.md`, the phase's spec, and `docs/templates/phase-checklist-template.md`.
2. Create `docs/phases/phase-NN-<kebab-name>.md` from the template (NN zero-padded, e.g. `phase-02-api-core`).
3. **Tasks:** break the spec into small, ordered, independently verifiable tasks. Each task gets an owner: `main` for cross-cutting/tooling work, or the matching specialist (`nextjs-developer`, `angular-developer`, `nestjs-developer`, `go-developer`, `spring-developer`). Order tasks so earlier ones unblock later ones.
4. **Acceptance criteria:** carry over from the spec, refined into verifiable statements.
5. **Verification:** list exact commands with expected results (`- [ ] \`command\` — expected`). Every acceptance criterion needs at least one check: builds, linters, tests, `docker compose` health checks, `curl` against endpoints. Commands must run from the repo root and be non-interactive.
6. Update the phase's row in `docs/ROADMAP.md` with the checklist link.
7. Show the user a summary of the checklist and ask for adjustments.
8. Hand off: suggest `/implement-phase <N>` next.

## Definition of done

The checklist file exists, follows the template, every task has an owner, every acceptance criterion is covered by a verification command, and the roadmap links to it.
