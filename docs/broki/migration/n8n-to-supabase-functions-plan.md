# Plan de migración: n8n → Supabase Edge Functions

Extiende [`n8n-to-supabase.md`](./n8n-to-supabase.md).

Los datos ya estaban en Supabase (`broki_legacy_rows` → `broki_normalize_all()` → `broki_*`).
Este documento cubre la **migración del runtime**: que las Edge Functions dejen de ser proxy
hacia n8n y lean/escriban directamente en las tablas canónicas.

---

## Diagnóstico inicial

| Estado | Detalle |
|--------|---------|
| Datos en Supabase | `broki_assets`, `broki_incidents`, `broki_personnel`, `broki_aircraft`, `broki_nitro_stock`, `broki_tooling_*`, `broki_planner_*` |
| Functions nativas antes de esta migración | `weather`, `broki-import-batch` |
| Functions proxy n8n (antes) | 12 — todas las demás |
| Functions nativas después | Todas excepto `roster-upload` |
| n8n permanente | WhatsApp/ManyChat, PDF planner, roster upload, sync incremental |

---

## Reglas transversales

- El shape HTTP que devuelven las functions **no cambia**: mismo contrato legacy que consumen los
  mappers de `web/src/lib/mappers/equipment.ts`.
- Writes usan `SUPABASE_SERVICE_ROLE_KEY`. Auditoría en `broki_audit_events`.
- Rollback por env: flag `*_USE_N8N=true` para cada function vuelve al proxy original.
- No se toca ningún workflow n8n productivo.

---

## Pre-flight (obligatorio antes de activar PR1)

```sql
-- Ejecutar en Studio o supabase db push
-- Migración: supabase/migrations/20260619180000_broki_preflight_check.sql
SELECT * FROM broki_normalize_legacy_validate();
```

Si `canonical_count = 0` para assets: `SELECT * FROM broki_normalize_all();`

---

## Capa compartida creada (`supabase/functions/_shared/`)

| Archivo | Rol |
|---------|-----|
| `supabase-admin.ts` | `createServiceClient()` con service role |
| `audit.ts` | `writeAudit(event_type, entity, entity_id, metadata)` → `broki_audit_events` |
| `legacy-assets.ts` | `assetToLegacyRow()`, `applyEquipmentUpdates()` |
| `legacy-incidents.ts` | `incidentToLegacyRow()` |
| `legacy-personnel.ts` | `personnelToLegacyRow()` |
| `legacy-aircraft.ts` | `aircraftToLegacyRow()` |
| `legacy-nitro-stock.ts` | `nitroStockToLegacyRow()`, `normalizeUbicacion()` |
| `legacy-tooling.ts` | `catalogToLegacyRow()`, `movementToLegacyRow()` |
| `legacy-planner.ts` | `groupToLegacyRow()`, `taskToLegacyRow()`, `normalizeMat()` |

---

## Matriz completa de migración

| Function | Webhook n8n (antes) | Tabla Supabase | Rollback flag |
|----------|---------------------|----------------|---------------|
| `inventory-list` | `pro_inventario` | `broki_assets` | `INVENTORY_USE_N8N` |
| `equipment-update` | `Inventario` | `broki_assets` + audit | `EQUIPMENT_USE_N8N` |
| `incidents` GET | `envio_incidencias` | `broki_incidents` | `INCIDENTS_USE_N8N` |
| `incidents` POST | `incidencias` | `broki_incidents` | `INCIDENTS_USE_N8N` |
| `personnel-list` | `pro_personal` | `broki_personnel` | `PERSONNEL_USE_N8N` |
| `aircraft-list` | `envio_avion` | `broki_aircraft` | `AIRCRAFT_USE_N8N` |
| `nitro-stock` GET | `envio_nitro_stock` | `broki_nitro_stock` | `NITRO_USE_N8N` |
| `nitro-stock` POST | `Inventario` | `broki_nitro_stock` | `NITRO_USE_N8N` |
| `tooling-list` | `tooling` + `registro_tooling` | `broki_tooling_catalog` + `broki_tooling_movements` | `TOOLING_USE_N8N` |
| `tooling-action` | `registro_tooling` | `broki_tooling_movements` | `TOOLING_USE_N8N` |
| `planner-groups` | `envio_grupo_trabajo` | `broki_planner_groups` + members | `PLANNER_USE_N8N` |
| `planner-tasks` | `envio_task` | `broki_planner_tasks` | `PLANNER_USE_N8N` |
| `planner-action` JSON | `grupotrabajo` | `broki_planner_*` | `PLANNER_USE_N8N` |
| `planner-action` multipart | `grupotrabajo` form | **n8n permanente** | `PLANNER_PDF_USE_N8N=false` para desactivar |
| `roster-upload` | `horario` | **n8n indefinido** | — |
| `broki-whatsapp-inbound` | `broki_produccion_in` | `broki_*` (PR8 completo) | `WHATSAPP_INBOUND_ENABLED` |
| `weather` | Open-Meteo | ya nativa | — |
| `broki-import-batch` | — | `broki_legacy_rows` | ya nativa |

---

## PR detalle

### PR0 — Capa _shared/

Archivos nuevos en `supabase/functions/_shared/`. Sin cambio funcional, prerequisito de todo.

### PR1 — Inventory / Equipment (P0)

**Tarjetas furgonetas y GSE leen/escriben `broki_assets`.**

`inventory-list`: `DISTINCT ON (identifier)` desde `broki_assets`, orden `updated_at DESC`.
`equipment-update`: busca por `identifier`, aplica `applyEquipmentUpdates()`, escribe audit.

Shape legacy preservado (`identificador`, `familia`, `trabajadores`, `nitrogeno_1..4`, etc.).

Pruebas manuales:
1. `/broki` — tarjetas visibles
2. Click tarjeta → modal con datos correctos
3. Editar ubicación, avión, operario, combustible, estado, notas, botellas N₂ → guardar
4. Refresh 30s → cambios persisten
5. `/broki/mapa` → posiciones por parking

SQL validación:
```sql
SELECT count(DISTINCT identifier) FROM broki_assets;
SELECT identifier, estado, parking, avion_text, current_worker_text, combustible
FROM broki_assets WHERE identifier = '<ID>';
SELECT event_type, count(*) FROM broki_audit_events GROUP BY 1;
```

### PR2 — Incidencias

`incidents` GET/POST → `broki_incidents`.

Acciones: `open_incident` (INSERT), `update_incident` (append mensaje en `raw_payload.messages`),
`close_incident` (`estado=0`, `fecha_cierre=now()`).

Nota: mensajes múltiples en `raw_payload` JSONB. Tabla `broki_incident_messages` → PR futura.

### PR3 — Datos auxiliares

`personnel-list` → `broki_personnel` (excluyendo `estado=0`).
`aircraft-list` → `broki_aircraft`.

### PR4 — Nitro stock

`nitro-stock` GET → `broki_nitro_stock`.
`nitro-stock` POST (`update_nitro_stock`) → upsert por `ubicacion`.

Separado del webhook `Inventario`. Updates de botellas GSE van por `equipment-update`.

Atención: typo legacy `cantida_de_botellas_llenas` se preserva intencionalmente
(lo lee `stock/page.tsx`).

### PR5 — Tooling

`tooling-list` → `{ catalog: broki_tooling_catalog, movements: broki_tooling_movements }`.
`tooling-action` checkout → INSERT movement; checkin → UPDATE movement `date_in`.

### PR6 — Planner

`planner-groups` → grupos + members, formato `trabajador_1..10`. Sin filtro "hoy" en backend.
`planner-tasks` → `broki_planner_tasks`.
`planner-action` JSON → `create`, `delete`, `toggle_task`, `delete_task`.
`planner-action` multipart/PDF → **sigue en n8n** vía flag `PLANNER_PDF_USE_N8N`.

### PR7 — Realtime frontend

`useEquipment.ts` suscribe a `broki_assets`, `broki_incidents`, `broki_nitro_stock`,
`broki_tooling_movements` via `supabase.channel().on('postgres_changes', ...)`.

v1: cualquier cambio → `fetchAll()`. v2 futura: patch local fino por evento.

### PR8 — WhatsApp inbound

Función `broki-whatsapp-inbound` creada con:
- Normalización teléfono (+34 strip)
- Lookup `broki_personnel`
- Registro en `broki_communications`
- Registro desconocidos en `broki_unknown_contacts`
- Esqueleto orquestador (FURGONETA / GSE / ATENCION_CLIENTE) — completar en PR8 full

Controlada por `WHATSAPP_INBOUND_ENABLED=true`. Mientras no esté activo, n8n sigue como handler.

`verify_jwt = false` en `config.toml` (webhook externo ManyChat sin JWT).

---

## Qué permanece en n8n

| Funcionalidad | Motivo |
|---------------|--------|
| `broki_produccion_in` (WhatsApp completo) | OpenAI agents, ManyChat, audio .ogg |
| `grupotrabajo` multipart / PDF | Parsing IA de flight plans |
| `horario` (roster) | Sin tabla `broki_*` destino |
| Pipeline `MIGRATION_EXPORT_*` → `broki-import-batch` | Sync incremental legacy Postgres |

---

## Checklist de activación por function

Para cada function, en staging antes de prod:

```
[ ] broki_assets / tabla destino tiene datos (SELECT count(*))
[ ] curl GET/POST local con JWT válido → respuesta correcta
[ ] UI afectada funciona sin errores de consola
[ ] Audit events creados en broki_audit_events para writes
[ ] Flag *_USE_N8N eliminado del env de staging
[ ] Deploy a prod
[ ] Monitorizar logs 30 min
```

---

## SQL suite de validación global

```sql
-- Conteos canónicos
SELECT 'assets',      count(*) FROM broki_assets
UNION ALL SELECT 'incidents',  count(*) FROM broki_incidents
UNION ALL SELECT 'personnel',  count(*) FROM broki_personnel
UNION ALL SELECT 'aircraft',   count(*) FROM broki_aircraft
UNION ALL SELECT 'nitro',      count(*) FROM broki_nitro_stock
UNION ALL SELECT 'tool_cat',   count(*) FROM broki_tooling_catalog
UNION ALL SELECT 'tool_mov',   count(*) FROM broki_tooling_movements
UNION ALL SELECT 'planner_g',  count(*) FROM broki_planner_groups
UNION ALL SELECT 'planner_t',  count(*) FROM broki_planner_tasks;

-- Writes auditados
SELECT event_type, entity, count(*)
FROM broki_audit_events
GROUP BY 1, 2 ORDER BY 3 DESC;

-- Incidencias abiertas
SELECT id_objeto, incident_code, status_text, fecha_apertura
FROM broki_incidents
WHERE estado = 1 OR status_text ILIKE '%abierta%';

-- Tooling sin devolver
SELECT bac_bact, tma_out, date_out
FROM broki_tooling_movements
WHERE date_in IS NULL;
```
