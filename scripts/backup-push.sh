#!/usr/bin/env bash
# Hourly GitHub backup push (lead tooling).
# Auth: GITHUB_TOKEN read from the gitignored .env (never committed, never logged).
# Exit 0 = push succeeded (or nothing to do); non-zero = failure (see log tail).
set -u -o pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1
LOG=".omc/reports/backup-push.log"
mkdir -p "$(dirname "$LOG")"
ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }

if [ ! -f .env ] || [ -z "$(sed -n 's/^GITHUB_TOKEN=//p' .env)" ]; then
  echo "$(ts) FAIL: GITHUB_TOKEN missing in .env" >>"$LOG"
  exit 1
fi

# Transient askpass: reads the token from .env at prompt time; nothing persisted.
ASK="$(mktemp /tmp/kbj-askpass.XXXXXX)"
cat >"$ASK" <<EOF
#!/bin/sh
case "\$1" in
  *Username*) printf '%s\n' x-access-token ;;
  *) sed -n 's/^GITHUB_TOKEN=//p' '$ROOT/.env' ;;
esac
EOF
chmod +x "$ASK"

OUT="$(GIT_TERMINAL_PROMPT=0 GIT_ASKPASS="$ASK" git push origin --all 2>&1 | sed 's|https://[^@ ]*@|https://|g'; GIT_TERMINAL_PROMPT=0 GIT_ASKPASS="$ASK" git push origin --tags 2>&1 | sed 's|https://[^@ ]*@|https://|g')"
RC=$?
rm -f "$ASK"
echo "$(ts) exit=$RC :: ${OUT:-nothing to push}" >>"$LOG"

# Keep the log bounded (~last 500 runs)
tail -n 500 "$LOG" >"$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"
exit $RC
