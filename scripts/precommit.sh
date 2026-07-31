#!/usr/bin/env bash
# Pre-commit gate: static checks + offline functional tests for every BROKI area.
# Live Edge Function smoke (needs `supabase start` + `functions serve`): npm run test:live
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "▶ lint"
npm run lint --prefix "$ROOT/web"

echo "▶ TypeScript"
npm exec --prefix "$ROOT/web" -- tsc --noEmit -p "$ROOT/web/tsconfig.json"

echo "▶ frontend (mappers, equipment, planner)"
npm test --prefix "$ROOT/web"

echo "▶ registration validation"
deno run "$ROOT/supabase/functions/_shared/register-validate.ts"

echo "▶ planner PDF parser"
deno run "$ROOT/supabase/functions/_shared/planner-parse.ts"

echo "▶ roster PDF parser"
deno run "$ROOT/supabase/functions/_shared/roster-parse.ts"

echo "▶ PDF pipeline + n8n independence (smoke offline)"
SMOKE_OFFLINE_ONLY=1 deno run -A --node-modules-dir=none "$ROOT/supabase/functions/_tests/smoke.ts"

echo "✓ pre-commit checks passed"
