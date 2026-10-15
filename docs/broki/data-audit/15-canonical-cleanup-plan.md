# 15 — Canonical cleanup plan (dry-run)

migration_id: `fc7cbf8b-7c2c-489f-bd85-72fbd38eca4c`

## Counts

```json
{
  "KEEP": 233,
  "MERGE": 282,
  "DELETE_CANDIDATE": 44,
  "REBUILD": 3
}
```

## Strategy

- **assets**: logical_key=upper(identifier); keeper=V7 preferred then kind van>gse>inventory; donors MERGE then DELETE; reassign FKs; alias donors
- **personnel**: KEEP v7 + web_registration; no blind deletes
- **planner**: DELETE groups/tasks not in V7 raw; KEEP v7 tasks even if group_id null
- **tooling**: DELETE smoke; REBUILD tool_id; enforce one open checkout/BAC
- **raw**: broki_legacy_rows untouched

Total actions: 562

No mutations executed by this script.
