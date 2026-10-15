# Fase 5 — Reconciliación entidad

- migration_id: `fc7cbf8b-7c2c-489f-bd85-72fbd38eca4c`
- veredicto: **FAIL**
- diffs: 115 (P0: 115)
- obsolete rows: 213
- payload drifts: 0
- tareas dedup collisions: 14

## Por entidad

```json
{
  "personal": {
    "raw": 70,
    "canonical": 70,
    "reconciled": 70,
    "missing_canonical": 0,
    "canonical_without_this_migration_raw": 0,
    "dup_phones": 0,
    "dup_emails": 0,
    "dup_bac": 0
  },
  "assets": {
    "reconciled": 94,
    "missing_canonical": 94,
    "trabajadores_lost": 0,
    "vehiculo_issues": 0,
    "identifier_dups": 0
  },
  "aircraft": {
    "raw": 18,
    "canonical": 18,
    "missing": 0,
    "msn_lost": 0,
    "motor_lost": 0
  },
  "incidents": {
    "raw": 34,
    "canonical": 59,
    "missing": 0,
    "orphan_no_asset": 0
  },
  "planner": {
    "groups_raw": 30,
    "groups_canonical": 30,
    "groups_missing": 0,
    "tasks": 29,
    "tasks_without_resolvable_group": 20,
    "group_link_column": "group_id"
  },
  "tooling": {
    "catalog_raw": 344,
    "catalog_canonical": 344,
    "catalog_missing": 0,
    "movements": 3,
    "movements_no_tool": 0,
    "open_bac_dups": []
  },
  "nitro": {
    "raw": 2,
    "canonical": 2
  },
  "registro_comunicaciones": {
    "raw": 1476,
    "canonical": 1476,
    "missing": 0
  },
  "n8n_chat_histories": {
    "raw": 6906,
    "canonical": 6906,
    "missing": 0
  },
  "no_existe_telefono": {
    "raw": 22,
    "canonical": 22,
    "missing": 0
  }
}
```

## Warnings

