# Secret rotation plan (F20B)

## Clasificación

**ROTATION_REQUIRED**

Evidencia: `Broki-export-20260810-185613.zip` contiene `.secrets/broki-service-secrets.env` (listado `unzip -Z1`).  
`export-repo-zip.sh` histórico no excluía `.secrets/`.

No se imprimen valores.

## Rotar (humano, orden)

1. Generar nuevos: `npm run secrets:generate` (salida a `.secrets/` gitignored).  
2. Supabase Dashboard → Secrets / API:  
   - `BROKI_N8N_SECRET`  
   - `BROKI_INTERNAL_FUNCTION_SECRET`  
   - `BROKI_NEXT_SERVER_SECRET`  
   - `BROKI_REMOTE_TEST_SECRET`  
   - valorar rotar **service_role** si el ZIP se compartió fuera del perímetro.  
3. `npm run secrets:push:supabase` (o set manual).  
4. n8n env vars.  
5. Vercel / server env (`BROKI_NEXT_SERVER_SECRET`, URL keys).  
6. CI secrets.  
7. Redeploy Edge Functions dashboard.  
8. Invalidar ZIP antiguos; borrar copias compartidas.  
9. `npm run export:verify -- --latest` en exports nuevos.

## Automatizado

- `export-repo-zip.sh` excluye `.secrets/**`, env, test-results, coverage, zips.  
- `npm run export:verify` falla ante paths/patrones.
