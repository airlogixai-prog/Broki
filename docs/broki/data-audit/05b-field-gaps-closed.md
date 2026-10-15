# 9.3 — Field gaps cerrados

Unresolved MISSING/UNKNOWN: **0**

| Source | Field | % valor | Class | Destino propuesto | Backfill |
|---|---|---:|---|---|---|
| pro.furgonetas | trabajadores | 82% | MAP_EXISTING_COLUMN | broki_assets.current_worker_text (+ current_worker_id via links) | true |
| pro.furgonetas | vehiculo | 100% | MAP_EXISTING_COLUMN | Map vehiculo → descripcion when descripcion/nombre_equipo empty; keep raw_payload.vehiculo. If product needs both labels, escalate to ADD_CANONICAL_COLUMN. | true |
| pro.gse | trabajadores | 36% | MAP_EXISTING_COLUMN | broki_assets.current_worker_text | true |
| pro.gse | brk | 100% | MAP_EXISTING_COLUMN | broki_assets.identifier coalesce(identificador, brk, id) | true |
| pro.aviones | compania | 100% | MAP_EXISTING_COLUMN | broki_aircraft.aerolinea | true |
| pro.aviones | msn | 0% | MAP_EXISTING_COLUMN | broki_aircraft.msn (dedicated) | true |
| pro.aviones | motor | 0% | MAP_EXISTING_COLUMN | broki_aircraft.motor | true |
| pro.tooling | tipo | 100% | MAP_EXISTING_COLUMN | broki_tooling_catalog — map tipo→tipo_tool or add tipo | true |
| pro.tooling | supplier | 100% | ADD_CANONICAL_COLUMN | ADD column broki_tooling_catalog.supplier OR raw_payload-only if UI unused | true |
| pro.tooling | manufacturer | 25% | ADD_CANONICAL_COLUMN | ADD column broki_tooling_catalog.manufacturer | true |
| n8n.nitro_stock | createdAt | 100% | RAW_ONLY_APPROVED | created_at already on table; do not map DataTable meta unless needed | false |
| n8n.nitro_stock | updatedAt | 100% | RAW_ONLY_APPROVED | updated_at / synced_at | false |
