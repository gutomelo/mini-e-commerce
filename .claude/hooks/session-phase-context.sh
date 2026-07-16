#!/usr/bin/env bash
# SessionStart: prints the current roadmap phase and its pending checklist items.
# Stdout becomes session context. No-ops until docs/ROADMAP.md exists.
set -uo pipefail

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
roadmap="$project_dir/docs/ROADMAP.md"

[ -f "$roadmap" ] || exit 0

row="$(grep -E '^\|' "$roadmap" | grep -m1 '| In Progress |' || true)"
if [ -z "$row" ]; then
  row="$(grep -E '^\|' "$roadmap" | grep -m1 '| Not Started |' || true)"
fi

if [ -z "$row" ]; then
  echo "Mini E-Commerce roadmap: all phases are Done. See docs/ROADMAP.md."
  exit 0
fi

num="$(printf '%s' "$row" | awk -F'|' '{ gsub(/ /, "", $2); print $2 }')"
name="$(printf '%s' "$row" | awk -F'|' '{ gsub(/^ +| +$/, "", $3); print $3 }')"
status="$(printf '%s' "$row" | awk -F'|' '{ gsub(/^ +| +$/, "", $6); print $6 }')"

echo "## Mini E-Commerce — Roadmap Context"
echo "Current phase: Phase $num — $name ($status). Source of truth: docs/ROADMAP.md."

case "$num" in
  '' | *[!0-9]*) exit 0 ;;
esac

checklist="$(ls "$project_dir"/docs/phases/phase-"$(printf '%02d' "$num")"-*.md 2>/dev/null | head -n1 || true)"
if [ -n "$checklist" ] && [ -f "$checklist" ]; then
  pending="$(grep '^- \[ \]' "$checklist" | head -n 10 || true)"
  if [ -n "$pending" ]; then
    echo "Pending items in docs/phases/$(basename "$checklist"):"
    printf '%s\n' "$pending"
  fi
else
  echo "This phase has no checklist yet — run /plan-phase $num after its spec is approved."
fi

echo "Workflow: /create-spec -> /plan-phase -> /implement-phase -> /verify-phase (blocking gate)."
echo "A phase is Done only after /verify-phase passes; do not start the next phase before that."
exit 0
