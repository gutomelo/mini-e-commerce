---
name: implement-phase
description: Execute the current Mini E-Commerce phase checklist, delegating stack-specific tasks to specialist subagents. Use when the user asks to implement, continue, or resume a phase (e.g. /implement-phase 1). Enforces the phase gate — refuses to start a phase whose predecessor is not Done.
---

# Implement Phase

The workflow orchestrator: executes `docs/phases/phase-NN-*.md` task by task, delegating to the right specialist agent, and keeps the checklist and roadmap in sync.

## Blocking gate (check FIRST)

1. Read `docs/ROADMAP.md` and identify the target phase (argument, or the first `In Progress`/`Not Started` phase).
2. If any earlier phase is not `Done`, STOP. Report which phase blocks and suggest `/verify-phase <blocker>` (or finishing its implementation). Never bypass the gate — only the user may explicitly override it, and the override must be stated in this conversation.
3. If the phase has no checklist file, stop and suggest `/plan-phase <N>`.

## Process

1. Set the phase's roadmap status to `In Progress` (if it was `Not Started`).
2. Read the phase checklist. Create a session task list mirroring the unchecked items, in order.
3. Execute tasks sequentially:
   - Tasks owned by `main`: implement directly in this session.
   - Tasks owned by a specialist (`nextjs-developer`, `angular-developer`, `nestjs-developer`, `go-developer`, `spring-developer`): delegate via the Agent tool to that subagent. Give the agent the task text, the spec path, the phase checklist path, and the relevant file paths. Review the result before accepting it.
4. After each completed task: mark it `- [x]` in the checklist file and commit the work with a Conventional Commit message scoped to the task (small commits, one logical change each).
5. When all tasks are checked: launch the `code-reviewer` subagent on the phase's full diff (`git diff <base>...HEAD`). Fix every finding it ranks as a defect; use judgment on style suggestions.
6. Do NOT mark the phase `Done` — that is exclusively `/verify-phase`'s job. Finish by suggesting `/verify-phase <N>`.

## Hard rules

- Follow `.claude/rules/rules-global.md` and the phase's spec. When they conflict with convenience, the rules win.
- American English in all code, comments, docs, and commit messages.
- Business logic never goes in controllers/components; respect Clean Architecture layers.
- If a task turns out to be wrong or impossible as written, update the checklist (and spec if needed) with the user's confirmation instead of silently diverging.
