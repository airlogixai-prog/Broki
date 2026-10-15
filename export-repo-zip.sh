#!/usr/bin/env bash
set -euo pipefail

# Crea un zip del repo listo para arrancar (sin node_modules).
# Excluye artefactos de build, .git, env locales y secretos.
# Tras descomprimir: npm install && npm install --prefix web
# Uso: ./export-repo-zip.sh [nombre.zip]
# Verificar: npm run export:verify

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT="${1:-Broki-export-${TIMESTAMP}.zip}"

if [[ "$OUTPUT" != /* ]]; then
  OUTPUT="$ROOT/$OUTPUT"
fi

if [[ -e "$OUTPUT" ]]; then
  echo "Error: ya existe $OUTPUT" >&2
  exit 1
fi

echo "Exportando repo -> $OUTPUT"

# ponytail: find + zip -@ — exclusiones explícitas; zip -x es frágil con ./
find . -type f \
  ! -path './node_modules/*' \
  ! -path './web/node_modules/*' \
  ! -path './web/.next/*' \
  ! -path './web/out/*' \
  ! -path './web/build/*' \
  ! -path './web/coverage/*' \
  ! -path './coverage/*' \
  ! -path './web/.vercel/*' \
  ! -path './.git/*' \
  ! -path './.secrets/*' \
  ! -path './.env' \
  ! -path './.env.local' \
  ! \( -path './.env.*' ! -path './.env.example' \) \
  ! -path './web/.env' \
  ! -path './web/.env.local' \
  ! \( -path './web/.env.*' ! -path './web/.env.example' \) \
  ! -path './supabase/.env' \
  ! -path './supabase/.env.local' \
  ! \( -path './supabase/.env.*' ! -path './supabase/.env.example' \) \
  ! -path './supabase/.temp/*' \
  ! -path './supabase/.branches/*' \
  ! -path './web/test-results/*' \
  ! -path './web/playwright-report/*' \
  ! -path './graphify-out/*' \
  ! -name '*.zip' \
  ! -name '*:Zone.Identifier' \
  ! -name '.DS_Store' \
  ! -name 'npm-debug.log*' \
  ! -name 'yarn-debug.log*' \
  ! -name 'yarn-error.log*' \
  ! -name '.pnpm-debug.log*' \
  ! -name '*.tsbuildinfo' \
  -print | zip -q -@ "$OUTPUT"

BYTES="$(stat -c%s "$OUTPUT" 2>/dev/null || stat -f%z "$OUTPUT")"
MB="$(awk "BEGIN { printf \"%.1f\", $BYTES / 1024 / 1024 }")"

echo "Verificando que no haya secretos..."
if ! node "$ROOT/scripts/verify-export-artifact.mjs" "$OUTPUT"; then
  rm -f "$OUTPUT"
  echo "Export abortado: el zip contenía rutas o patrones prohibidos" >&2
  exit 1
fi

echo "Listo: $OUTPUT (${MB} MB)"
