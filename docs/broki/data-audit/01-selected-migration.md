# Fase 0 — Migración seleccionada

| Campo | Valor |
|---|---|
| migration_id | `fc7cbf8b-7c2c-489f-bd85-72fbd38eca4c` |
| started_at | 2026-08-04T20:54:56.655Z |
| finished_at | 2026-08-04T20:55:36.737Z |
| status | all snapshots success (verified in Fase 1) |
| sources | 20 |
| expected_rows | 9316 |
| imported_rows | 9316 |
| failed_rows | 0 |
| batches | 27 / 27 |
| workflow meta | `metadata.importer_version` / n8n V7 (declarado por operador) |

## Criterio de selección

Último `metadata.migration_id` con **todos** los snapshots `status=success`, `failed_rows=0`, `finished_at` no nulo.

## Alcance (fuentes)

- `n8n_datatable` / `n8n` / `nitro_stock` (2 filas)
- `n8n_postgres_pro` / `pro` / `aviones` (18 filas)
- `n8n_postgres_pro` / `pro` / `furgonetas` (17 filas)
- `n8n_postgres_pro` / `pro` / `grupo_trabajo` (30 filas)
- `n8n_postgres_pro` / `pro` / `gse` (77 filas)
- `n8n_postgres_pro` / `pro` / `historial` (0 filas)
- `n8n_postgres_pro` / `pro` / `incidencias` (34 filas)
- `n8n_postgres_pro` / `pro` / `inventario` (94 filas)
- `n8n_postgres_pro` / `pro` / `n8n_chat_histories` (6906 filas)
- `n8n_postgres_pro` / `pro` / `no_existe_telefono` (22 filas)
- `n8n_postgres_pro` / `pro` / `personal` (70 filas)
- `n8n_postgres_pro` / `pro` / `registro_comunicaciones` (1476 filas)
- `n8n_postgres_pro` / `pro` / `tareas` (57 filas)
- `n8n_postgres_pro` / `pro` / `tool_control` (3 filas)
- `n8n_postgres_pro` / `pro` / `tooling` (344 filas)
- `n8n_postgres_public` / `public` / `public__furgonetas` (16 filas)
- `n8n_postgres_public` / `public` / `public__gse` (53 filas)
- `n8n_postgres_public` / `public` / `public__personal` (86 filas)
- `n8n_postgres_public` / `public` / `public__registro_comunicaciones` (11 filas)
- `n8n_postgres_public` / `public` / `public__tool_control` (0 filas)
