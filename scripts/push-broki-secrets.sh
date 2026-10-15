#!/usr/bin/env bash
# Push BROKI service secrets to the Supabase project.
# Requires:
#   ALLOW_SECRET_PUSH=true
#   SUPABASE_PROJECT_REF=mjtuxabpjsgggezrsdrw
#
# Usage:
#   ALLOW_SECRET_PUSH=true SUPABASE_PROJECT_REF=mjtuxabpjsgggezrsdrw npm run secrets:push:supabase
set -euo pipefail
cd "$(dirname "$0")/.."

# ── Gate ────────────────────────────────────────────────────────────────────
if [[ "${ALLOW_SECRET_PUSH:-}" != "true" ]]; then
  echo "Set ALLOW_SECRET_PUSH=true to push secrets to Supabase." >&2
  exit 1
fi

ALLOWED_REF="mjtuxabpjsgggezrsdrw"
if [[ "${SUPABASE_PROJECT_REF:-}" != "$ALLOWED_REF" ]]; then
  echo "SUPABASE_PROJECT_REF must be $ALLOWED_REF" >&2
  exit 1
fi

# ── Verify secrets file ──────────────────────────────────────────────────────
SECRETS_FILE=".secrets/broki-service-secrets.env"
if [[ ! -f "$SECRETS_FILE" ]]; then
  echo "Secrets file not found: $SECRETS_FILE" >&2
  echo "Run: npm run secrets:generate" >&2
  exit 1
fi

# Verify permissions
FILE_PERMS=$(stat -c "%a" "$SECRETS_FILE")
if [[ "$FILE_PERMS" != "600" ]]; then
  echo "Secrets file permissions must be 0600 (got $FILE_PERMS). Fix: chmod 600 $SECRETS_FILE" >&2
  exit 1
fi

# ── Run secrets:check first ─────────────────────────────────────────────────
echo "Running secrets:check..."
node scripts/check-broki-service-secrets.mjs

# ── Push secrets ─────────────────────────────────────────────────────────────
echo "Pushing secrets to Supabase project $ALLOWED_REF..."
npx supabase secrets set --project-ref "$ALLOWED_REF" --env-file "$SECRETS_FILE"

# Push additional operational flags
npx supabase secrets set --project-ref "$ALLOWED_REF" \
  "BROKI_ALLOWED_PROJECT_REFS=$ALLOWED_REF" \
  "BROKI_ALLOW_LEGACY_IMPORT=1"

# ── Verify names only (no values) ───────────────────────────────────────────
echo ""
echo "Verifying secret names in Supabase (values not shown)..."
npx supabase secrets list --project-ref "$ALLOWED_REF" 2>&1 | grep -E "BROKI_|Name" || true

echo ""
echo "Secrets pushed successfully. Deploy functions to apply: npm run functions:deploy:dashboard"
