# 20 — Final Closure Baseline (Fase 20A)

**Fecha:** 2026-08-10  
**Modo:** reauditoría cruzada F0–F19 — **sin cambios de código en esta fase**  
**Proyecto:** `mjtuxabpjsgggezrsdrw`  
**migration_id V7:** `fc7cbf8b-7c2c-489f-bd85-72fbd38eca4c`

## Método

- Contrastar docs vs código/scripts/REST live.
- No cleanup destructivo en 20A.
- No reimport 9316.

## Inventario repo (live)

| Área | Conteo / nota |
|------|----------------|
| Migrations SQL | 27 |
| Edge Functions (dirs) | 18 (+ `_shared`, `_tests`) |
| E2E specs | acceptance, broki, gse-parking, public |
| Git | worktree dirty (cambios F10–F19 + hardening no todos commit) |
| Deploy script | `scripts/deploy-dashboard-functions.sh` — **omite** `aircraft-action`, `marketing-lead` |
| `package.json` `functions:deploy:dashboard` | idem omite aircraft-action / marketing-lead |
| ZIP reciente | `Broki-export-20260810-185613.zip` |

## Invariantes DATA (REST + RPC, 2026-08-10)

| Invariante | Esperado | Actual | PASS? |
|------------|----------|--------|-------|
| raw V7 rows | 9316 | 9316 | **PASS** |
| logical assets | 94 | 94 | **PASS** |
| unexpected logical dups | 0 | 0 | **PASS** |
| recoverable orphans (relation RPC) | 0 | 0 | **PASS** |
| smoke personnel | 0 | 0 | **PASS** |
| smoke tooling movements | 0 | 0 | **PASS** |
| `broki_verify_canonical_cleanup` ok | true | **false** | **FAIL / P0** |

### P0 regresión — verify cleanup

```json
{
  "ok": false,
  "assets_count": 94,
  "orphan_groups": 3,
  "orphan_tasks": 6,
  "smoke_movements": 0,
  "logical_asset_dups": 0,
  "broken_tool_relations": 0,
  "open_checkout_dups": 0,
  "legacy_rows_intact": 9529
}
```

Definición de orphan en RPC: grupo/tarea **sin** `external_id` en RAW V7 `grupo_trabajo`/`tareas`.  
Tras F11 estaban a 0. Filas nuevas = writes app/smoke post-F11 (no en cleanup de residuos personal/movimientos).

Clasificación: **DELETE_CANDIDATE smoke/app-test** pendiente dry-run (no ejecutado en 20A).

## AuthZ (código)

| Hallazgo | Severidad |
|----------|-----------|
| `authenticateBrokiUser`: todo JWT válido → `role=operator` + `dashboard:read/write` | **P0** |
| Comentario ponytail admite upgrade a tabla permisos | documentado, no hecho |
| `roster-upload` POST: `authorizeOrRespond(..., mutation)` **sin** `assertUserCanWrite` | **P0** |
| RLS: policy `"Authenticated users can read"` `USING (true)` en tablas broki core/legacy | **P0** |
| `auth_user_id` en personnel existe; F12: 0 linkables auto | OK / proceso invite-only |

## Secrets / artefactos

| Hallazgo | Severidad |
|----------|-----------|
| `.gitignore` excluye `.secrets/` | OK en git |
| `export-repo-zip.sh` **NO** excluye `.secrets/**` | **P0** |
| ZIP `Broki-export-20260810-185613.zip` **contiene** `.secrets/broki-service-secrets.env` | **P0 + ROTATION_REQUIRED** |
| No imprimir valores | respetado |

## Source parity

| Gate | Status |
|------|--------|
| SOURCE CURRENT vs V7 | **UNKNOWN** / `BLOCKED_EXTERNAL` — sin `LEGACY_DATABASE_URL` |
| RAW = V7 | PASS (9316) |
| Canonical logical | PASS_WITH_APPROVED_DIFFS (F19) salvo regresión orphans verify |

## Writers / SoT

| Canal | Writer hoy | Riesgo |
|-------|------------|--------|
| Dashboard Next | Supabase `broki_*` | OK si Hostinger freeze |
| WhatsApp ManyChat→n8n | **PostgreSQL pro.*** | **P0 dual SoT** si Dashboard cutover sin redirigir WA assets a Supabase |
| `broki-whatsapp-inbound` | gated off | correcto no activar |

## E2E / release (histórico readiness)

- Creds default inválidas / skips acceptance
- Remote smoke ≠ browser E2E

## Conclusión 20A

Invariantes core DATA (raw/assets/dups/smoke moves) **siguen**.  
**Regresión nueva:** orphan planner 3+6 en verify.  
**P0 abiertos estructurales:** auth=authorization, RLS open, ZIP secrets, deploy incompleto, dual SoT WA, source UNKNOWN, E2E release.

**Veredicto preliminar post-20A (no final):** **NOT READY** — no se declara READY por build.

Siguiente: 20B→20J con remediación + evidencia; veredicto final en `20-final-closure-report.md`.
