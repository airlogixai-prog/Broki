# 18 — Production hardening

Fecha: 2026-08-10  
Alcance: residuos test + secretos + E2E/smoke cleanup.

## CLEANUP (DELETE_CANDIDATE / smoke QA)

### Canónico Fase 11 (ya aplicado)

| Acción audit | Count |
|---|---:|
| DELETE_CANDIDATE | 44 |
| MERGE | 282 |
| REBUILD | 3 |

verify F11: `ok=true`. Smoke movements BAC-SMK: **0**. Orphan planner: **0**.

### Residuos post-F11 (esta fase)

Script: `scripts/cleanup-broki-test-residues.mjs`  
Solo alta confianza: `Smoke Test Persona`, `QA Persona Playwright`, `smoke*@example.com`, `qa*@example.com`, leads smoke, aerolinea=SMOKE / MSN-SMK.

| Entidad | Borrados |
|---|---:|
| personnel | 10 |
| tooling_movements | 0 (ya limpios F11) |
| aircraft SMOKE | 0 |
| marketing_leads | 0 |

Verify live: smoke personnel **0**, smoke movements **0**, aircraft SMOKE **0**.

RAW `broki_legacy_rows`: no tocado.

## SECRETS

| Check | Resultado |
|---|---|
| `web/src` service_role / SECRET | **0** |
| `NEXT_PUBLIC_*SERVICE*` | **0** |
| JWT literal `eyJhbGciOi` en repo (excl. `.env`) | **0** |
| Workflows n8n export | `$env.SUPABASE_SERVICE_ROLE_KEY` only |
| Scripts admin | leen env; no hardcode |

**Rotación:** si la service role se usó en terminales/chat de migración, rotar en Supabase Dashboard → API → regenerate `service_role`. Actualizar secretos Edge Functions / n8n / `.env.local` locales. Anon key no rota salvo exposición.

## E2E / smoke finally

| Archivo | Cambio |
|---|---|
| `supabase/functions/_tests/smoke.ts` | `try/finally` + cleanup tracked (relay, planner, personnel, movement, aircraft, lead) + sweep por `SMOKE_RUN_ID` / correo smoke / aerolinea SMOKE. Señales SIGINT/SIGTERM. |
| `web/e2e/broki.spec.ts` | Registration + tooling checkout: cleanup en `finally` vía REST service role (si hay env). |

## DONE gates

| Gate | Status |
|---|---|
| 0 residuos test conocidos | PASS |
| 0 secretos inline | PASS |
| 0 service role cliente | PASS |
| 0 movimientos smoke | PASS |
| 0 canonical zombie F11 aprobado | PASS (audit 44 DELETE aplicados) |
