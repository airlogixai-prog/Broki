# 17 — Canonical → EF → API → mapper → UI (P0)

## Veredicto

Pipeline tipado para dominios operativos. Campos P0 dejan de vivir solo en `raw_payload` en la capa UI.

## Contrato

| Capa | Cambio |
|---|---|
| `web/src/lib/api/canonical.ts` | DTOs: Asset, Aircraft, Tooling, Incident, Planner, Nitro, Personnel |
| `web/src/lib/api/broki.ts` | `N8nRow` eliminado de responses de listado |
| `web/src/lib/mappers/equipment.ts` | `workerId`, `dbId`, snapshots; tipos fuertes |
| `web/src/lib/mappers/tooling.ts` | **nuevo** — tipo/supplier/manufacturer/part/serial/ubicacion canónicos primero |
| `web/src/lib/mappers/planner.ts` | sin `Record` suelto |
| Tooling UI | muestra manufacturer, supplier, serial |
| `database.types` | `msn` / `motor` en aircraft |

## P0 coverage

| Campo | Mapper | UI |
|---|---|---|
| current_worker_text | → `worker` | EquipmentCard / Detail |
| current_worker_id | → `workerId` | tipado (UI muestra texto; UUID para writes) |
| vehiculo | → `model` si descripcion vacía | sí |
| identifier/BRK | → `id` | sí |
| aerolinea | → `airline` / WorkGroup | AircraftRegistry / WorkGroupCard |
| msn / motor | → Aircraft | AircraftRegistry |
| tooling.tipo | canónico > familia | badge |
| supplier / manufacturer / serial | canónico | catalog list |
| part_number / ubicacion_habitual | canónico | sí |

## Decisiones intencionales (no gap)

- `auth_user_id`: no UI operativa (admin/auth).
- `incident.planner_task_id`: HISTORICAL null; UI de incidencias no lista tasks.
- `workerId` UUID: no se pinta (texto snapshot es lo operativo en cards).
- Action POST bodies: siguen `Record` abierto (servidor valida).

## Tests

`web/src/lib/mappers/pipeline-p0.test.ts` — 5 casos: furgo/gse/aircraft/tooling.

`npm test` → 25 pass. `tsc --noEmit` limpio tras fixes.
