---
name: verify-phase
description: Run the blocking verification gate for a Mini E-Commerce phase. Use after implementing a phase or when the user asks to verify one (e.g. /verify-phase 1). Runs every command in the phase checklist's Verification section and marks the phase Done in docs/ROADMAP.md only if everything passes.
---

# Verify Phase

The gate. The ONLY skill allowed to set a phase to `Done` in `docs/ROADMAP.md`.

## Process

1. Identify the target phase (argument, or the current `In Progress` phase in `docs/ROADMAP.md`). Read its checklist file `docs/phases/phase-NN-*.md`.
2. Confirm every item under **Tasks** and **Prerequisites** is checked. Unchecked tasks = fail fast: report them and stop (suggest `/implement-phase <N>`).
3. Run EVERY command in the **Verification** section, exactly as written, from the repo root. Never skip, reorder into partial runs, or substitute weaker commands. Capture output for each.
4. Compare each result against its documented expected result.

## Outcome

**All checks pass:**
- Mark each verification item `- [x]` in the checklist file.
- Set the phase's status to `Done` in `docs/ROADMAP.md`.
- Commit: `docs: mark phase NN as done` (include the checklist + roadmap changes).
- Report a pass summary (check → evidence) and suggest the next phase's `/create-spec` or `/plan-phase`.

**Any check fails:**
- Leave the roadmap status as `In Progress` and the failed items unchecked.
- Report each failure with the command, the relevant output, and the concrete fix needed.
- Do NOT attempt large fixes inside this skill; hand the fix list to `/implement-phase <N>` (small, obvious fixes — a typo, a missing file — may be fixed and the failed checks re-run).

## Hard rules

- Never mark a phase `Done` with any failing or skipped check — no exceptions, including user pressure; the honest state of the gate is the point.
- Never edit a Verification command to make it pass; if a command is genuinely wrong, fix it with the user's confirmation and note the change in the report.
- Report results faithfully: failing output is quoted as-is.
