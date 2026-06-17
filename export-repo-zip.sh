#!/usr/bin/env bash
set -euo pipefail

# Crea un zip del repo excluyendo artefactos pesados y secretos.
# Uso: ./export-repo-zip.sh [nombre.zip]

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

zip -r "$OUTPUT" . \
  -x "./node_modules/*" \
  -x "./web/node_modules/*" \
  -x "./web/.next/*" \
  -x "./web/out/*" \
  -x "./web/build/*" \
  -x "./web/coverage/*" \
  -x "./web/.vercel/*" \
  -x "./.git/*" \
  -x "./*.zip" \
  -x "./_airlogixai.com.zip" \
  -x "./supabase/.temp/*" \
  -x "./supabase/.branches/*" \
  -x "./.env" \
  -x "./.env.*" \
  -x "./web/.env" \
  -x "./web/.env.*" \
  -x "./supabase/.env" \
  -x "./supabase/.env.*" \
  -x "./*:Zone.Identifier" \
  -x "./web/*:Zone.Identifier" \
  -x "./.DS_Store" \
  -x "./**/.DS_Store" \
  -x "./**/npm-debug.log*" \
  -x "./**/yarn-debug.log*" \
  -x "./**/yarn-error.log*" \
  -x "./**/.pnpm-debug.log*" \
  -x "./**/*.tsbuildinfo"

BYTES="$(stat -c%s "$OUTPUT" 2>/dev/null || stat -f%z "$OUTPUT")"
MB="$(awk "BEGIN { printf \"%.1f\", $BYTES / 1024 / 1024 }")"

echo "Listo: $OUTPUT (${MB} MB)"
