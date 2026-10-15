# 15 — Fase 11 canonical cleanup (before/after)

migration_id: `fc7cbf8b-7c2c-489f-bd85-72fbd38eca4c`  
apply run_id: `992eac55-65c4-4110-b8c2-86fa4535e9ba`  
dry-run run_id: `1e0ae9c5-f873-4c51-ac44-7f7842eb89e0`

## Principio

- `broki_legacy_rows`: **intactas** (ledger histórico; no cleanup operativo).
- Canónico: una realidad operacional.

## Plan (11.1 dry-run script)

`node scripts/plan-broki-canonical-cleanup.mjs`

| Action | Count |
|---|---:|
| KEEP | 233 |
| MERGE | 282 |
| DELETE_CANDIDATE | 44 |
| REBUILD | 3 |

Detalle assets: 94 KEEP + 282 MERGE → target 94 filas.

## Estrategia assets (11.2)

- Logical key: código humano (`BRK-*`, `G4-6`, …) vía `broki_asset_logical_key(identifier, external_id)` (evita zombies con identifier numérico).
- Keeper: V7 + kind `van > gse > inventory`.
- Donors: enrich keeper (`coalesce` campos operativos) → reassign FKs → alias → DELETE.
- Inventario vs furgoneta/GSE mismo código → **una** entidad (operacional gana).

## Personal (11.3)

Sin DELETE. KEEP: 70 V7 + 10 `web_registration`.

## Planner (11.4)

DELETE orphans no-V7: 16 groups + 22 tasks. KEEP tasks V7 aunque `group_id` null (`SOURCE_GROUP_NULL`).

## Tooling (11.5)

- DELETE 6 smoke (`BAC-SMK-*`).
- REBUILD 3 `tool_id` por BAC.
- Open checkout dups: 0.

## Transacción (11.6)

- RPC: `broki_canonical_cleanup(mid, dry_run)`.
- Audit: `broki_canonical_cleanup_audit` (backup jsonb por fila).
- Verify: `broki_verify_canonical_cleanup(mid)`.
- Normalize guard: `last_migration_id is not null` + skip inventario si ya existe van/gse mismo logical key.

## Before → After

| Métrica | Before | After | Target |
|---|---:|---:|---|
| assets | 376 | 94 | 94 |
| logical_asset_dups | 94 | **0** | 0 |
| orphan_groups | 16 | **0** | 0 |
| orphan_tasks | 22 | **0** | 0 |
| smoke_movements | 6 | **0** | 0 |
| broken_tool_relations | 3 | **0** | 0 |
| open_checkout_dups | 0 | 0 | 0 |
| legacy_rows | 9529 | **9529** | intact |

verify.ok = **true**

## Rollback

1. Filas borradas en audit (`action in (MERGE, DELETE_CANDIDATE)`, `run_id`, `dry_run=false`) con `backup` jsonb.
2. Reinsertar desde `backup` (assets / planner / movements).
3. Revertir `tool_id` REBUILD si hace falta (audit `REBUILD`).
4. RAW no requiere rollback (nunca tocado).

```sql
-- list deleted asset IDs for run
select canonical_id, merge_into, logical_key, reason
from broki_canonical_cleanup_audit
where run_id = '992eac55-65c4-4110-b8c2-86fa4535e9ba'
  and entity_type = 'asset' and action = 'MERGE';
```

## Artefactos

- `scripts/plan-broki-canonical-cleanup.mjs`
- `scripts/apply-broki-canonical-cleanup.mjs`
- `supabase/migrations/20260810180000_broki_canonical_cleanup.sql`
- `supabase/migrations/20260810180100_broki_canonical_cleanup_fix.sql`
- `docs/broki/data-audit/15-canonical-cleanup-plan.{json,md}`
- `docs/broki/data-audit/15-canonical-cleanup-dry-run.json`
- `docs/broki/data-audit/15-canonical-cleanup-apply.json`
