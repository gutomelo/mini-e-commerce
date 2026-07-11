---
name: create-spec
description: Create a specification document for a Mini E-Commerce phase or feature. Use when starting a new phase, designing a new feature, or when the user asks for a spec. Guides a short brainstorm, then writes the spec to docs/specs/ from the spec template.
---

# Create Spec

Produce an approved specification before any planning or implementation. Specs are the entry point of the workflow: `/create-spec` → `/plan-phase` → `/implement-phase` → `/verify-phase`.

## Hard rules

- Write the spec in American English.
- Do NOT implement anything while creating a spec. No code, no scaffolding.
- YAGNI: cut every feature that is not required by the phase's objective in `docs/ROADMAP.md`.

## Process

1. **Gather context.** Read `docs/ROADMAP.md`, the roadmap summary for the target phase, related existing specs in `docs/specs/`, and `.claude/rules/rules-global.md`. Check the current state of the affected apps/packages.
2. **Clarify.** Ask the user questions ONE AT A TIME (prefer multiple choice) until purpose, constraints, and success criteria are clear. Skip questions whose answers are already fixed by the roadmap or project rules.
3. **Propose approaches.** Present 2-3 approaches with trade-offs and a clear recommendation. Let the user pick.
4. **Write the spec.** Copy the structure of `docs/templates/spec-template.md` into `docs/specs/YYYY-MM-DD-<topic>.md` (today's date, kebab-case topic). Fill every section; delete the template's HTML comments.
5. **Self-review.** Scan for placeholders (TBD/TODO), internal contradictions, ambiguous requirements, and oversized scope. Fix inline.
6. **User review gate.** Ask the user to review the spec file. Apply requested changes and re-run the self-review. When the user approves, set `Status: Approved`.
7. **Link it.** Add/refresh the spec link in the phase's row of `docs/ROADMAP.md`.
8. **Hand off.** Suggest running `/plan-phase <N>` next. Do not start planning inside this skill.

## Definition of done

The spec file exists, is `Approved`, has no open questions (or all explicitly deferred with a target phase), and is linked from the roadmap.
