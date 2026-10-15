# 13 — Remediation master plan (Fase 9)

## Veredicto fase: **FAIL**

DoD requires known YES/NO for current source vs V7; agent lacks legacy Postgres access → UNKNOWN

Source vs V7: **UNKNOWN**

### Action counts

{
  "DELETE_CANDIDATE": 210,
  "KEEP": 220,
  "BACKFILL": 13,
  "REBUILD": 1,
  "MANUAL_REVIEW": 0
}

## P0

| ID | Type | Cause | Fix | Backfill | Cleanup | Tests |
|---|---|---|---|---|---|---|
| R9-P0-01 | NORMALIZER | trabajadores plural not mapped | alias in broki_normalize_assets | from broki_legacy_rows V7 | no | parity workers |
| R9-P0-02 | NORMALIZER | compania not mapped to aerolinea | alias compania in broki_normalize_aircraft | yes | no | aerolinea filled |
| R9-P0-03 | NORMALIZER | brk not in identifier coalesce | identifier keys + brk | yes | no | gse id=brk |
| R9-P0-04 | DEDUP | normalize ignores last_migration_id → ×2 assets | normalize filter last_migration_id OR cleanup zombies then constrain | rebuild from V7 raw | DELETE_CANDIDATE old-run assets | canonical count == V7 raw per table |
| R9-P0-05 | RELATION | tasks without group_id + orphan groups | fix link in normalize_planner_tasks; cleanup orphan groups/tasks | yes from id_grupo_trabajo | orphan DELETE_CANDIDATE | tasks_without_group for V7 = only SOURCE_GROUP_NULL |
| R9-P0-06 | CLEANUP | BAC-SMK smoke movements | delete smoke movements after audit sign-off | no | yes | no BAC-SMK open |

## P1

| ID | Type | Cause | Fix |
|---|---|---|---|
| R9-P1-01 | SCHEMA | vehiculo / tooling supplier|manufacturer | map or add columns |
| R9-P1-02 | NORMALIZER | msn/motor coalesce | dedicated columns |
| R9-P1-03 | RELATION | tool_control movements tool_id null for legacy BAC | broki_normalize_legacy_links by bac |
| R9-P1-04 | CLEANUP | 213 obsolete raw (last_migration_id null / pre-V3) | archive/delete obsolete raw after zombie asset cleanup | no | yes | obsolete=0 |

## P2

- R9-P2-01 (RUNTIME): incident_messages empty by design
- R9-P2-02 (TEST): source freshness UNKNOWN

## Field gaps (cerrados — no MISSING/UNKNOWN sin clase)

| Source | Field | Class | Destino propuesto |
|---|---|---|---|
| pro.furgonetas | trabajadores | MAP_EXISTING_COLUMN | broki_assets.current_worker_text (+ current_worker_id via links) |
| pro.furgonetas | vehiculo | MAP_EXISTING_COLUMN | Map vehiculo → descripcion when descripcion/nombre_equipo empty; keep raw_payload.vehiculo. If product needs both labels, escalate to ADD_CANONICAL_COLUMN. |
| pro.gse | trabajadores | MAP_EXISTING_COLUMN | broki_assets.current_worker_text |
| pro.gse | brk | MAP_EXISTING_COLUMN | broki_assets.identifier coalesce(identificador, brk, id) |
| pro.aviones | compania | MAP_EXISTING_COLUMN | broki_aircraft.aerolinea |
| pro.aviones | msn | MAP_EXISTING_COLUMN | broki_aircraft.msn (dedicated) |
| pro.aviones | motor | MAP_EXISTING_COLUMN | broki_aircraft.motor |
| pro.tooling | tipo | MAP_EXISTING_COLUMN | broki_tooling_catalog — map tipo→tipo_tool or add tipo |
| pro.tooling | supplier | ADD_CANONICAL_COLUMN | ADD column broki_tooling_catalog.supplier OR raw_payload-only if UI unused |
| pro.tooling | manufacturer | ADD_CANONICAL_COLUMN | ADD column broki_tooling_catalog.manufacturer |
| n8n.nitro_stock | createdAt | RAW_ONLY_APPROVED | created_at already on table; do not map DataTable meta unless needed |
| n8n.nitro_stock | updatedAt | RAW_ONLY_APPROVED | updated_at / synced_at |

NO implementar Fase 10 desde este documento sin aprobación.
