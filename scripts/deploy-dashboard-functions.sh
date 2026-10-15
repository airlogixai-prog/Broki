#!/usr/bin/env bash
# Deploy dashboard Edge Functions to linked remote. Skips broki-whatsapp-inbound.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f web/.env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source web/.env.local
  set +a
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-mjtuxabpjsgggezrsdrw}"
SUPA=(npx supabase)

# Keep in sync with config/broki/function-manifest.json DASHBOARD + ETL used by ops.
FUNCS=(
  inventory-list
  personnel-list
  aircraft-list
  aircraft-action
  tooling-list
  tooling-action
  planner-groups
  planner-tasks
  planner-action
  incidents
  nitro-stock
  relays
  roster-upload
  equipment-update
  personnel-register
  marketing-lead
  broki-import-batch
)

echo "Deploying ${#FUNCS[@]} dashboard/public/etl functions → project $PROJECT_REF"
"${SUPA[@]}" functions deploy "${FUNCS[@]}" --use-api --project-ref "$PROJECT_REF"
