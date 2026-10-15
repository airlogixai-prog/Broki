# Data contract matrix — legacy PostgreSQL → raw → canonical

> Paridad de datos BROKI. Sin cambios de UI. `broki_legacy_rows` nunca se borra.

## Pipeline auditado

```mermaid
flowchart LR
  PG[(pro.* Postgres)] --> N8N[n8n workflow V2]
  DT[(nitro_stock DataTable)] --> N8N
  N8N -->|to_jsonb t full row| EF[broki-import-batch]
  EF --> RAW[broki_legacy_rows.row_data]
  RAW --> NORM[broki_normalize_*]
  NORM --> CAN[broki_* + raw_payload]
```

### Workflow fuente

| Campo | Valor |
|-------|-------|
| Nombre | `MIGRATION_EXPORT_ALL_BROKI_TO_SUPABASE_RAW_NO_SECRET_SAFE_V2` |
| Archivo | `docs/private/n8n/MIGRATION_EXPORT_ALL_BROKI_TO_SUPABASE_RAW_NO_SECRET_SAFE_V2.json` |
| Export PG | `SELECT to_jsonb(t) FROM pro.{table}` — **todas las columnas** |
| Batch | 1000 filas |
| Auth import | `Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY` |
| Edge Function | `broki-import-batch` → upsert `broki_legacy_rows` |
| Nitro | Rama paralela: DataTable `nitro_stock` → `source_system: n8n_datatable` |

### Garantía raw

`broki-import-batch` guarda cada item **sin transformar** en `row_data`. Si Postgres exporta N columnas, `row_data` tiene N keys (nombres tal cual `to_jsonb`).

`raw_payload` en tablas `broki_*` = copia de `row_data` en normalize (`r.row_data`). Verificación: `broki_audit_raw_payload_parity()`.

---

## Matriz por entidad

Leyenda:

- **PG** = columna esperada en PostgreSQL legacy (`pro.*` o DataTable)
- **Raw** = key en `broki_legacy_rows.row_data`
- **Canonical** = columna en tabla `broki_*`
- **Norm** = función `broki_normalize_*`

| source_table | PG | Raw key | Canonical table | Canonical column | Norm |
|--------------|----|---------|-----------------|------------------|------|
| `personal` | `pro.personal` | `id` | `broki_personnel` | `legacy_id` | `broki_normalize_personnel` |
| | | `nombre` | | `nombre` | |
| | | `telefono` | | `telefono` | |
| | | `cod_empleado_aena` | | `cod_empleado_aena` | |
| | | `helper`…`b2_otros` (ratings) | | mismos nombres | |
| | | *todas* | | `raw_payload` | |
| `inventario` | `pro.inventario` | `identificador` | `broki_assets` | `identifier` | `broki_normalize_assets` |
| | | `descripcion`, `estado`, `combustible`… | | columnas asset | `asset_kind=inventory` |
| `furgonetas` | `pro.furgonetas` | idem inventario | `broki_assets` | idem | `asset_kind=van` |
| `gse` | `pro.gse` | idem + `nitrogeno_*` | `broki_assets` | idem | `asset_kind=gse` |
| `incidencias` | `pro.incidencias` | `id_incidencia` | `broki_incidents` | `incident_code` | `broki_normalize_incidents` |
| | | `id_objeto` | | `id_objeto` → FK `asset_id` (links) | |
| | | `trabajador` | | `trabajador_text` → `worker_id` | |
| `grupo_trabajo` | `pro.grupo_trabajo` | `id_avion`, `responsable`… | `broki_planner_groups` | columnas planner | `broki_normalize_planner_groups` |
| | | `trabajador_1`…`10` | `broki_planner_group_members` | `worker_text` | (child insert) |
| `tareas` | `pro.tareas` | `id_grupo_trabajo` | `broki_planner_tasks` | `grupo_trabajo_external_id` | `broki_normalize_planner_tasks` |
| | | | | `group_id` (FK, post-link) | `broki_normalize_legacy_links` |
| `aviones` | `pro.aviones` | `matricula` | `broki_aircraft` | `matricula` | `broki_normalize_aircraft` |
| `tooling` | `pro.tooling` | `bac` / `bac_bact` | `broki_tooling_catalog` | `bac_bact` | `broki_normalize_tooling_catalog` |
| | | `tipo_tool`, `part_number`… | | solo en `raw_payload` | raw_only |
| `tool_control` | `pro.tool_control` | `bac_bact`, `date_out`… | `broki_tooling_movements` | columnas movement | `broki_normalize_tooling_movements` |
| `registro_comunicaciones` | `pro.registro_comunicaciones` | `id_chat`, `telefono`… | `broki_communications` | columnas comm | `broki_normalize_communications` |
| `n8n_chat_histories` | `pro.n8n_chat_histories` | `session_id`, `role`, `message` | `broki_chat_histories` | columnas chat | `broki_normalize_chat_histories` |
| `no_existe_telefono` | `pro.no_existe_telefono` | `telefono`, `mensaje`… | `broki_unknown_contacts` | columnas contact | `broki_normalize_unknown_contacts` |
| `nitro_stock` | n8n DataTable | `ubicacion`, `cantidad_de_botellas_*` | `broki_nitro_stock` | `ubicacion`, `botellas_*` | `broki_normalize_nitro_stock` |

Mapa machine-readable completo: [`config/broki/legacy-field-map.json`](../../config/broki/legacy-field-map.json).

---

## Conteos esperados

Función: `broki_normalize_legacy_validate()` / `broki_audit_entity_counts()`.

| entity | raw `source_table` | canonical |
|--------|-------------------|-----------|
| personal | `personal` | `broki_personnel` |
| aviones | `aviones` | `broki_aircraft` |
| inventario+furgonetas+gse | 3 tablas | `broki_assets` (suma) |
| incidencias | `incidencias` | `broki_incidents` |
| grupo_trabajo | `grupo_trabajo` | `broki_planner_groups` |
| tareas | `tareas` | `broki_planner_tasks` |
| tooling | `tooling` | `broki_tooling_catalog` |
| tool_control | `tool_control` | `broki_tooling_movements` |
| registro_comunicaciones | `registro_comunicaciones` | `broki_communications` |
| n8n_chat_histories | `n8n_chat_histories` | `broki_chat_histories` |
| no_existe_telefono | `no_existe_telefono` | `broki_unknown_contacts` |
| nitro_stock | `nitro_stock` | `broki_nitro_stock` |

**Regla:** `raw_count === canonical_count` por entidad (excepto `inventario+furgonetas+gse` agrupado en assets).

---

## Correcciones forward-only (20260802180000)

| Problema | Fix |
|----------|-----|
| `id_grupo_trabajo` en tareas solo usado en links, no columna | `broki_planner_tasks.grupo_trabajo_external_id` + normalizer actualizado |
| Sin herramientas SQL de auditoría | `broki_audit_entity_counts`, `broki_audit_raw_payload_parity`, `broki_audit_legacy_row_keys` |
| Links tareas→grupo dependían solo de `row_data` | `broki_normalize_legacy_links` usa columna nueva + fallback raw |

---

## Cómo verificar

### 1. Aplicar migración (local o remoto, sin escrituras de negocio)

```bash
npx supabase db push   # solo si autorizado
# o en SQL Editor remoto: ejecutar 20260802180000_broki_data_parity_audit.sql
```

### 2. Re-normalizar (idempotente)

```sql
select * from broki_normalize_legacy_all();
```

### 3. Auditoría SQL

```sql
select * from broki_audit_entity_counts() where status <> 'OK';
select * from broki_audit_raw_payload_parity() limit 20;
select * from broki_audit_legacy_row_keys() where source_table = 'personal';
```

### 4. Auditoría Node (read-only)

```bash
SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/audit-broki-data-parity.mjs
node scripts/audit-broki-data-parity.mjs --json
```

Requiere `service_role` — tablas legacy con RLS solo `authenticated`, anon devuelve 401.

---

## Columnas raw-only (preservadas, no normalizadas a columna)

Campos que el dashboard legacy usa pero el normalizer deja en `raw_payload`:

| Tabla | Columnas |
|-------|----------|
| `tooling` | `tipo_tool`, `part_number`, `serial_number`, `rango`, `ubicacion_habitual`, `notas` |
| Cualquiera | Columnas nuevas en PG no listadas en normalizer — siguen en `raw_payload` |

**Política:** no se pierden datos; se auditan como `extra_keys` en el script.

---

## Referencias

- Ingesta: `supabase/functions/broki-import-batch/index.ts`
- Normalize: `supabase/migrations/20260617220000_broki_normalize_legacy.sql`
- Parity audit: `supabase/migrations/20260802180000_broki_data_parity_audit.sql`
- Tablas lista: `config/broki/n8n-source-tables.json`
