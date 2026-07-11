#!/usr/bin/env bash
# PreToolUse (Edit|Write|Read): blocks access to files that may contain secrets.
# .env.example files are always allowed. Exit 2 blocks the tool call.
set -euo pipefail

payload="$(cat)"

if command -v jq >/dev/null 2>&1; then
  file_path="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty')"
elif command -v python3 >/dev/null 2>&1; then
  file_path="$(printf '%s' "$payload" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null || true)"
else
  file_path="$(printf '%s' "$payload" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
fi

[ -z "$file_path" ] && exit 0

base="$(basename "$file_path")"

case "$base" in
  .env.example | .env.*.example | *.example)
    exit 0
    ;;
  .env | .env.* | *.pem | *.key)
    {
      echo "Blocked: '$file_path' may contain secrets."
      echo "Real .env files, private keys, and certificates must never be read or edited by the agent."
      echo "Document required variables in .env.example instead; the user manages real values."
    } >&2
    exit 2
    ;;
esac

exit 0
