#!/usr/bin/env bash
# PostToolUse(Edit|Write): run `tsc --noEmit` when a src/lib file is touched.
# The core lib (math-engine, validation, *-client) is coverage-critical and
# CI gates on `yarn typecheck`; surfacing type errors here turns a multi-minute
# CI failure into instant local feedback.
input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

case "$file" in
  *src/lib/*) ;;
  *) exit 0 ;;
esac

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0

echo "Running yarn typecheck (edited $file)…" >&2
if ! yarn typecheck >&2; then
  echo "Typecheck failed after editing $file — fix the type error before continuing." >&2
  exit 2
fi

exit 0
