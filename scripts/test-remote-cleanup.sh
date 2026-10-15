#!/usr/bin/env bash
# Manual cleanup of smoke test residues.
# Reads the same env as test-remote.sh.
# Use when a smoke run left orphaned data (smoke_run_id in metadata).
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f web/.env.local ]]; then
  echo "missing web/.env.local" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source web/.env.local
set +a
export SUPABASE_URL="${SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-}}"
export SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-${NEXT_PUBLIC_SUPABASE_ANON_KEY:-${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-}}}"

SECRETS_FILE=".secrets/broki-service-secrets.env"
if [[ -z "${BROKI_REMOTE_TEST_SECRET:-}" && -f "$SECRETS_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$SECRETS_FILE"
  set +a
fi

echo "Running cleanup-only smoke against $SUPABASE_URL"
SMOKE_OFFLINE_ONLY=0 SMOKE_CLEANUP_ONLY=1 \
  exec deno run -A --node-modules-dir=none supabase/functions/_tests/smoke.ts
