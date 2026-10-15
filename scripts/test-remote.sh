#!/usr/bin/env bash
# Live smoke against the BROKI remote Supabase project.
# Reads web/.env.local for URL and publishable key.
# Loads BROKI_REMOTE_TEST_SECRET from .secrets/broki-service-secrets.env if present.
#
# Required gates:
#   ALLOW_REMOTE_WRITE_TESTS=true   — enables write operations
#   SUPABASE_PROJECT_REF=mjtuxabpjsgggezrsdrw  — allowlist check
#
# Usage:
#   ALLOW_REMOTE_WRITE_TESTS=true npm run test:remote

set -euo pipefail
cd "$(dirname "$0")/.."

# ── Gate: allow-write flag ──────────────────────────────────────────────────
if [[ "${ALLOW_REMOTE_WRITE_TESTS:-}" != "true" ]]; then
  echo "Set ALLOW_REMOTE_WRITE_TESTS=true to run remote smoke tests." >&2
  exit 1
fi

# ── Gate: project ref allowlist ─────────────────────────────────────────────
ALLOWED_REF="mjtuxabpjsgggezrsdrw"
ACTUAL_REF="${SUPABASE_PROJECT_REF:-}"
if [[ -z "$ACTUAL_REF" ]]; then
  echo "SUPABASE_PROJECT_REF not set. Set it to $ALLOWED_REF to confirm target." >&2
  exit 1
fi
if [[ "$ACTUAL_REF" != "$ALLOWED_REF" ]]; then
  echo "SUPABASE_PROJECT_REF '$ACTUAL_REF' is not in the allowlist." >&2
  exit 1
fi

# ── Load base env ────────────────────────────────────────────────────────────
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

if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_ANON_KEY" ]]; then
  echo "SUPABASE_URL and anon/publishable key required in web/.env.local" >&2
  exit 1
fi

# ── Verify URL contains the expected project ref ────────────────────────────
if [[ "$SUPABASE_URL" != *"$ALLOWED_REF"* ]]; then
  echo "SUPABASE_URL '$SUPABASE_URL' does not contain expected ref '$ALLOWED_REF'." >&2
  exit 1
fi

# ── Load service secret (no set -x while loading) ───────────────────────────
SECRETS_FILE=".secrets/broki-service-secrets.env"
if [[ -z "${BROKI_REMOTE_TEST_SECRET:-}" && -f "$SECRETS_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$SECRETS_FILE"
  set +a
fi

if [[ -z "${BROKI_REMOTE_TEST_SECRET:-}" ]]; then
  echo "Warning: BROKI_REMOTE_TEST_SECRET not set. Auth hardening checks will be skipped." >&2
  echo "  Generate secrets: npm run secrets:generate" >&2
  echo "  Deploy to Supabase: npm run secrets:push:supabase" >&2
fi

export SMOKE_RUN_ID
SMOKE_RUN_ID="$(node -e "console.log(require('node:crypto').randomUUID())")"

echo "Remote smoke → $SUPABASE_URL"
echo "Run ID: $SMOKE_RUN_ID"
exec deno run -A --node-modules-dir=none supabase/functions/_tests/smoke.ts
