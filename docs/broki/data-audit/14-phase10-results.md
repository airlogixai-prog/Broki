# Fase 10 — RAW→canonical contract fix

**migration_id:** `fc7cbf8b-7c2c-489f-bd85-72fbd38eca4c`  
**Aplicado:** 2026-08-10 (schema + normalizers + backfill). Sin DELETE de zombies.

## Migrations

| Archivo | Rol |
|---------|-----|
| `20260810170000_broki_canonical_field_schema.sql` | tooling: tipo, supplier, manufacturer, part_number, serial_number, ubicacion_habitual |
| `20260810170100_broki_fix_normalize_aliases.sql` | aircraft / assets / tooling_catalog aliases |
| `20260810170200_broki_backfill_canonical_v7.sql` | `broki_backfill_canonical_from_legacy(mid, dry_run)` + verify RPC |

## Alias rules

- `trabajador` \| `trabajadores` → `current_worker_text`
- `identificador` \| `brk` \| `id` → `identifier`
- `descripcion` else `vehiculo` → `descripcion` (sin columna nueva)
- `aerolinea` \| `compania` → `aerolinea`
- `msn` / `motor` columnas dedicadas (≠ matricula/modelo)
- tooling `tipo`/`supplier`/`manufacturer` (+ part/serial/ubicacion)
- nitro typo ya cubierto en normalize nitro

## Before / after (scoped V7)

| Check | Before | After |
|-------|-------:|------:|
| furgonetas con worker | 0 | **14** |
| gse con worker | 0 | **28** |
| aircraft aerolinea | 0 | **18** |
| tooling.tipo | 0 | **344** |
| tooling.supplier | 0 | **344** |
| tooling.manufacturer | 0 | **87** |

Dry-run pre-apply: assets 94 / aircraft 18 / tooling 344 would change.  
Dry-run post-apply: **0** (idempotente).

Verify RPC: furgonetas.trabajadores OK, aviones.compania OK, tooling.tipo OK, gse.brk CHECK 77/77.

## Rollback lógico

1. No se borró raw.
2. Re-aplicar valores previos desde `raw_payload` histórico o re-run backfill tras revertir funciones `CREATE OR REPLACE` a versión anterior (migración forward de rollback).
3. Columnas tooling nuevas son nullable → safe leave; drop solo con migración forward explícita si se exige.

## No hecho (a propósito)

- DELETE_CANDIDATE / cleanup zombies ×2
- Reimport Postgres
- Planner group_id / tooling movement tool_id (Fase posterior)
