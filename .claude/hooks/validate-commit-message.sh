#!/usr/bin/env bash
# PreToolUse (Bash): validates Conventional Commits on `git commit` commands.
# Fails open when the message cannot be extracted (commitlint enforces it again at git level).
set -euo pipefail

payload="$(cat)"

if command -v jq >/dev/null 2>&1; then
  cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty')"
elif command -v python3 >/dev/null 2>&1; then
  cmd="$(printf '%s' "$payload" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null || true)"
else
  cmd="$payload"
fi

# Act only when `git commit` sits in command position (start of command or after ; & | && ||).
printf '%s' "$cmd" | grep -qE '(^|[;&|(][[:space:]]*|&&[[:space:]]*|\|\|[[:space:]]*)git[[:space:]]+commit' || exit 0
printf '%s' "$cmd" | grep -qE '(^|[[:space:]])(-m|--message)' || exit 0

# Subject line: first line after the commit's heredoc opener, or the value passed to -m/--message.
# Backslashes are stripped before matching so escaped quotes do not corrupt extraction.
if printf '%s' "$cmd" | grep -q '<<'; then
  subject="$(printf '%s\n' "$cmd" | awk '/git[[:space:]]+commit/ && /<</ { found = 1; next } found { print; exit }')"
else
  norm="$(printf '%s' "$cmd" | tr -d '\\')"
  # First -m/--message only: with subject + body flags, the subject comes first.
  subject="$(printf '%s' "$norm" \
    | grep -oE "(--message|-m)[= ][[:space:]]*[\"'][^\"']*" \
    | head -n1 \
    | sed -E "s/^(--message|-m)[= ][[:space:]]*[\"']//")"
fi

[ -z "$subject" ] && exit 0

pattern='^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9./-]+\))?!?: .+'
printf '%s' "$subject" | grep -qE "$pattern" && exit 0

{
  echo "Blocked: commit message does not follow Conventional Commits."
  echo "Subject found: \"$subject\""
  echo "Expected: <type>(<scope>)?: <description>"
  echo "Types: feat fix docs style refactor perf test build ci chore revert"
  echo "Example: feat(api): add product listing endpoint"
} >&2
exit 2
