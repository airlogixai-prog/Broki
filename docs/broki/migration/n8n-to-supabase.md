# Migración n8n/Postgres → Supabase

## Fases

1. **Schema core** — tablas canónicas `broki_*` (vacías). Migración `20260617213000_broki_core_schema.sql`.
2. **Ingesta raw** — cada fila legacy se guarda intacta en `broki_legacy_rows` vía Edge Function `broki-import-batch`.
3. **Normalización** (futuro) — ETL desde raw hacia `broki_*`. No perder datos aunque el mapeo cambie.

```mermaid
flowchart LR
  N8N[n8n batches] --> EF[broki-import-batch]
  EF --> Raw[broki_legacy_rows]
  EF --> Snap[broki_legacy_table_snapshots]
  EF --> Err[broki_legacy_import_errors]
  Raw --> Norm[normalizar a broki_*]
```

## Tablas origen detectadas

| Origen | Notas |
|--------|-------|
| `pro.personal` | DataTable n8n + Postgres |
| `pro.inventario` | SQL directo en dashboard |
| `pro.incidencias` | webhooks incidencias |
| `pro.grupo_trabajo` | planner |
| `pro.tareas` | planner |
| `pro.aviones` | envío aviones |
| `pro.tooling` / `pro.tool_control` | tooling |
| `pro.furgonetas` / `pro.gse` | assets |
| `pro.registro_comunicaciones` | comunicaciones |
| `pro.n8n_chat_histories` | chat IA |
| `pro.no_existe_telefono` | contactos desconocidos |
| n8n DataTable `nitro_stock` | stock nitrógeno (no Postgres) |

Lista machine-readable: [`config/broki/n8n-source-tables.json`](../../config/broki/n8n-source-tables.json).

## Workflow n8n

Importar en n8n (sin activar en producción):

[`docs/private/n8n/MIGRATION_EXPORT_ALL_BROKI_TO_SUPABASE_RAW_NO_SECRET_SAFE_V2.json`](../../private/n8n/MIGRATION_EXPORT_ALL_BROKI_TO_SUPABASE_RAW_NO_SECRET_SAFE_V2.json)

Variables de entorno requeridas en n8n:

- `SUPABASE_URL` — p. ej. `https://<project-ref>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` — service role key del proyecto

## Autenticación (sin BROKI_IMPORT_SECRET)

La versión actual del workflow n8n **no usa** `BROKI_IMPORT_SECRET` ni la cabecera `x-broki-import-secret`.

La versión actual del workflow n8n usa autenticación mediante `Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY`. Por eso la Edge Function `broki-import-batch` debe tener `verify_jwt=true`. No se debe usar `verify_jwt=false` si no existe un secreto custom server-to-server.

Secrets Supabase necesarios:

```bash
npx supabase secrets set N8N_BASE_URL="https://n8n.airlogixai.com/webhook"
```

## Payload de ejemplo (n8n)

Postgres (`pro.*`):

```json
{
  "source_system": "n8n_postgres_pro",
  "source_schema": "pro",
  "source_table": "personal",
  "items": [
    {
      "id": 1,
      "nombre": "Juan",
      "telefono": "+34600000000"
    }
  ]
}
```

DataTable `nitro_stock`:

```json
{
  "source_system": "n8n_datatable",
  "source_schema": "n8n",
  "source_table": "nitro_stock",
  "items": [
    {
      "ubicacion": "Hangar 1",
      "cantida_de_botellas_llenas": "10",
      "cantidad_de_botellas_vacias": "2"
    }
  ]
}
```

- Máximo **1000** items por request.
- `external_id` se resuelve en orden: `external_id`, `id`, `identificador`, `brk`, `codigo`, `id_incidencia`. Si ninguno existe, se usa hash SHA-256 estable del JSON.

## HTTP Request node (n8n)

| Campo | Valor |
|-------|-------|
| Method | `POST` |
| URL | `{{ $env.SUPABASE_URL }}/functions/v1/broki-import-batch` |
| Header `Content-Type` | `application/json` |
| Header `apikey` | `{{ $env.SUPABASE_SERVICE_ROLE_KEY }}` |
| Header `Authorization` | `Bearer {{ $env.SUPABASE_SERVICE_ROLE_KEY }}` |
| Body | JSON del payload anterior |

No añadir `x-broki-import-secret`.

Respuesta esperada:

```json
{
  "ok": true,
  "source_table": "personal",
  "received": 100,
  "upserted": 100,
  "errors": []
}
```

## Export SQL (Postgres legacy)

El nodo **Export Postgres legacy rows** crea `pg_temp.broki_export_legacy_raw()` y devuelve un batch por fila:

- Recorre las 13 tablas `pro.*` listadas arriba.
- Salta tablas inexistentes con `to_regclass(...)` + `RAISE NOTICE` (no aborta el resto).
- Ordena filas usando solo `to_jsonb(t)->>'campo'` (nunca columnas directas como `t.bac`).
- Pagina en lotes de 1000.

## Verificación post-importación

En Supabase SQL Editor:

```sql
select source_system, source_schema, source_table, count(*)
from broki_legacy_rows
group by 1, 2, 3
order by 1, 2, 3;

select *
from broki_legacy_import_errors
order by created_at desc
limit 50;
```

Comparar conteos con el origen antes de pasar a normalización `broki_legacy_rows → broki_*`.

## Verificación local

```bash
npm run db:reset
npm run db:types

curl -X POST http://127.0.0.1:54321/functions/v1/broki-import-batch \
  -H "Content-Type: application/json" \
  -H "apikey: <local-service-role-key>" \
  -H "Authorization: Bearer <local-service-role-key>" \
  -d '{"source_system":"n8n_postgres_pro","source_schema":"pro","source_table":"personal","items":[{"id":1,"nombre":"test"}]}'
```

Comprobar filas en Studio: http://127.0.0.1:54323 → `broki_legacy_rows`.

## Qué no tocar

- Workflows productivos (`PRODUCCION_*.json`) — crear workflows **nuevos** solo para migración.
- Frontend (`web/`) — la ingesta es server-to-server vía Edge Function.
- Normalización a `broki_*` — pendiente hasta validar conteos en raw.
