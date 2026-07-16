#!/usr/bin/env bash
# PostToolUse (Edit|Write): formats the edited file with its stack's formatter.
# Never blocks; no-ops gracefully while toolchains are not installed yet.
set -uo pipefail

payload="$(cat)"

if command -v jq >/dev/null 2>&1; then
  file_path="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty')"
elif command -v python3 >/dev/null 2>&1; then
  file_path="$(printf '%s' "$payload" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null || true)"
else
  file_path="$(printf '%s' "$payload" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
fi

[ -z "$file_path" ] && exit 0
[ -f "$file_path" ] || exit 0

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"

case "$file_path" in
  *.ts | *.tsx | *.js | *.jsx | *.json | *.md | *.css | *.scss | *.html | *.yml | *.yaml)
    if [ -d "$project_dir/node_modules" ] && command -v pnpm >/dev/null 2>&1; then
      if (cd "$project_dir" && pnpm exec prettier --write "$file_path" >/dev/null 2>&1); then
        echo "Formatted with Prettier: $file_path"
      fi
    fi
    ;;
  *.go)
    if command -v gofmt >/dev/null 2>&1; then
      gofmt -w "$file_path" && echo "Formatted with gofmt: $file_path"
    fi
    ;;
  *.java)
    : # Formatting handled by the payment service's build tooling (Spotless) once configured.
    ;;
esac

exit 0
