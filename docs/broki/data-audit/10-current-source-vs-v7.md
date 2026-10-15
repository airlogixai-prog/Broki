# 9.1 — Source actual vs V7

## ¿V7 sigue representando el origen ACTUAL? **UNKNOWN**

Motivo: No LEGACY_DATABASE_URL / BROKI_LEGACY_DATABASE_URL in agent environment; n8n Postgres credentials not accessible from repo

### Diferencias

- SOURCE_TABLE_NEW: 0
- SOURCE_FIELD_NEW: 0
- SOURCE_ROWS_CHANGED_AFTER_V7: 0

### Proxy signals (Supabase only)

```json
{
  "v7_finished_at": "2026-08-04T20:55:36.737Z",
  "raw_latest_synced_at": "2026-08-04T20:55:36.681+00:00",
  "raw_latest_migration_id": "fc7cbf8b-7c2c-489f-bd85-72fbd38eca4c",
  "assets_latest_updated_at": "2026-08-04T20:55:37.161553+00:00",
  "personnel_latest_updated_at": "2026-08-04T20:55:37.161553+00:00",
  "note": "If canonical updated_at >> V7 finished_at, app wrote after migration; does not prove legacy PG changed"
}
```

### Limitaciones

- Cannot query information_schema on live legacy Postgres from this session
- Workflows PRODUCCION_REGISTROS_DASHBOARD / PRODUCCION_FLUJO_PRINCIPAL / Desarrollo not present as files in repo (only referenced by operator / n8n cloud)
- V7 RAW completeness proven for run itself; freshness vs origin after 2026-08-04T20:55Z not verifiable here

Para cerrar YES/NO: ejecutar `information_schema` + counts contra Postgres legacy con la misma credencial n8n `Postgres account` y diff vs manifest V7.
