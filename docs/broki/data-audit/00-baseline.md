# Fase 0 — Baseline y migración exitosa

**Fecha auditoría:** 2026-08-04  
**Proyecto Supabase:** `mjtuxabpjsgggezrsdrw`  
**Modo:** READ-ONLY (sin normalizadores, upserts, migraciones ni smoke de escritura)

## Commit base

| Campo | Valor |
|-------|--------|
| HEAD | `8d9e738104e20f09997a574dc4a2ae7d769c3d7c` |
| Mensaje | `feat(security): service auth for edge functions and dashboard updates` |

## Working tree

Árbol **sucio**: integración V3 + fixes nitro/planner + docs WIP sin commitear (~161 paths en `git status --short`).  
Commit base = HEAD; no se usa un commit limpio de “solo auditoría”.

### WIP relevante (no aplicado como commit)

- `supabase/functions/broki-import-batch/index.ts` (+ helpers `_shared/legacy-import|nitro-normalize|planner-normalize`)
- Migraciones locales aún no necesariamente en remoto histórico:
  - `20260804204000_broki_migration_v3_audit.sql`
  - `20260804215000_fix_broki_nitro_stock_normalization.sql`
  - `20260804220000_fix_broki_planner_tasks_normalization.sql`
  - `20260804223000_fix_broki_audit_manifest_rpc.sql`
- Docs V3 / workflow n8n

## Tablas / objetos de control (desde SQL del repo)

| Rol | Nombre real |
|-----|-------------|
| Filas RAW | `public.broki_legacy_rows` (+ `last_migration_id`) |
| Snapshots | `public.broki_legacy_table_snapshots` (`metadata.migration_id`) |
| Batches | `public.broki_legacy_import_batches` |
| Errores import | `public.broki_legacy_import_errors` |
| Idempotencia HTTP | `public.broki_idempotency_keys` |
| Audit app | `public.broki_audit_events` |
| **No existe** tabla `migration_runs` / `source_manifest` persistida | El manifiesto vive en el workflow + se reconstruye desde snapshots |

### RPCs de auditoría

- `broki_audit_source_manifest(p_manifest, p_migration_id)`
- `broki_audit_migration_snapshots(p_migration_id)`
- `broki_audit_entity_counts()` / `(p_migration_id)`
- `broki_audit_raw_payload_parity()`
- `broki_audit_obsolete_rows(p_migration_id)`
- `broki_audit_tareas_dedup_collisions()`
- `broki_normalize_legacy_validate()` — **no ejecutada** en esta fase

## Scripts existentes

- `scripts/audit-broki-data-parity.mjs` (conteos globales / keys sample)
- Secrets helpers (no usados para escritura aquí)

## Functions relevantes

`broki-import-batch`, listados dashboard (`personnel-list`, `inventory-list`, …), `nitro-stock`, planner, tooling, incidents.

## Config local

`web/.env.local` presente (URL + secret key). Acceso REST service-role para lectura.  
**Limitación:** Edge Functions con JWT de usuario → 401 si se llama solo con service key sin headers Broki/user.

## Gates locales (Fase 0)

Ver `00-baseline` entrega / sección tests en informe final. Solo unit/integration/build/lint.
