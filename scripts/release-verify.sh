#!/usr/bin/env bash
# Single release verification entrypoint. Fail-closed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== ci:install =="
npm run ci:install

echo "== lint =="
npm run lint

echo "== tsc =="
npm exec --prefix web -- tsc --noEmit -p web/tsconfig.json

echo "== unit =="
npm run test:unit

echo "== integration =="
npm run test:integration

echo "== build =="
npm run build

echo "== function manifest =="
npm run functions:verify-manifest

echo "== export verify (latest zip if present) =="
if ls Broki-export-*.zip >/dev/null 2>&1; then
  npm run export:verify -- --latest || true
  # Always build a fresh clean zip under /tmp and require PASS
fi
TMPZIP="/tmp/broki-release-export-$$.zip"
rm -f "$TMPZIP"
./export-repo-zip.sh "$TMPZIP"
npm run export:verify -- "$TMPZIP"

echo "== start Next =="
pkill -f "next start -p 3000" 2>/dev/null || true
npm run start --prefix web -- -p 3000 >/tmp/broki-next-release.log 2>&1 &
NEXT_PID=$!
trap 'kill $NEXT_PID 2>/dev/null || true' EXIT
for i in $(seq 1 30); do
  if curl -sf --max-time 2 -o /dev/null http://127.0.0.1:3000/login; then break; fi
  sleep 1
done
curl -sf --max-time 5 -o /dev/null http://127.0.0.1:3000/login

echo "== e2e:release =="
npm run test:e2e:release

echo "== remote smoke =="
npm run test:remote

echo "== remote cleanup =="
npm run test:remote:cleanup

echo "== data logical check =="
node scripts/verify-data-invariants.mjs

echo "release:verify PASS"
