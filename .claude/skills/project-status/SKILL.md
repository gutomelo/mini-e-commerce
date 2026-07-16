---
name: project-status
description: Show the Mini E-Commerce roadmap status — phase table, progress, current phase pending items, and the suggested next command. Read-only; use when the user asks where the project stands or what to do next.
---

# Project Status

Read-only snapshot of the roadmap. Makes NO changes to any file.

## Process

1. Read `docs/ROADMAP.md`.
2. For each phase that has a checklist file in `docs/phases/`, count checked (`- [x]`) vs. total tasks.
3. Report, in this order:
   - **Roadmap table:** phase, status, task progress (e.g. `7/12`), spec/checklist availability.
   - **Current phase:** the first non-`Done` phase — its objective and up to 10 pending tasks with owners.
   - **Next command:** exactly one suggestion:
     - current phase has no approved spec → `/create-spec`
     - approved spec but no checklist → `/plan-phase <N>`
     - checklist with unchecked tasks → `/implement-phase <N>`
     - all tasks checked but status not `Done` → `/verify-phase <N>`
     - all phases `Done` → celebrate; the roadmap is complete.
4. Flag inconsistencies (e.g. a phase marked `Done` with unchecked tasks, broken links) without fixing them; recommend the skill that should fix them.
