#!/usr/bin/env bash
# Strict E2E for release gates. Fail-closed. No default passwords. No skips.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "${BROKI_SKIP_E2E:-}" == "1" ]]; then
  echo "FAIL: BROKI_SKIP_E2E=1 forbidden in release E2E" >&2
  exit 1
fi

if [[ -z "${E2E_EMAIL:-}" || -z "${E2E_PASSWORD:-}" ]]; then
  echo "FAIL: E2E_EMAIL and E2E_PASSWORD required (no defaults)" >&2
  exit 1
fi

if [[ ! -f web/playwright.config.ts || ! -d web/e2e ]]; then
  echo "FAIL: playwright config or e2e dir missing" >&2
  exit 1
fi

BASE="${E2E_BASE_URL:-http://127.0.0.1:3000}"
if ! curl -sf --max-time 5 -o /dev/null "$BASE/login"; then
  echo "FAIL: Next not reachable at $BASE/login" >&2
  exit 1
fi

export BROKI_E2E_RELEASE=1
export E2E_BASE_URL="$BASE"
export CI="${CI:-1}"

cd web
exec npx playwright test --reporter=line
