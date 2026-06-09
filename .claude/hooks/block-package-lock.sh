#!/usr/bin/env bash
# PreToolUse(Edit|Write): block creating or editing package-lock.json.
# Equinox standardizes on yarn (CI runs `yarn install --frozen-lockfile`),
# so an npm lockfile only causes drift between the two lockfiles.
input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

case "$file" in
  */package-lock.json | package-lock.json)
    echo "Blocked: this project uses yarn (CI runs 'yarn install --frozen-lockfile')." >&2
    echo "Do not create or edit package-lock.json — it causes lockfile drift. Use yarn.lock instead." >&2
    exit 2
    ;;
esac

exit 0
