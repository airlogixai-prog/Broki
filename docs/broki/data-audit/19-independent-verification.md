# 19 — Independent Migration Verification

**Cierre: NOT_CLOSED**

V7 **no** es prueba de origen actual.

## DONE gates (live 2026-08-10T15:49:58.454Z)

| Gate | Valor |
|---|---|
| SOURCE CURRENT = LATEST RAW | **UNKNOWN** (sin LEGACY_DATABASE_URL) |
| LATEST RAW = CANONICAL logical | **PASS_WITH_APPROVED_DIFFS** |
| MISSING unexpected | **0** |
| UNKNOWN | **1** |
| P0 unexpected | **0** |
| unexpected orphans | **0** |
| logical duplicates | **0** |
| test residues | **0** |

## SOURCE

No hay `LEGACY_DATABASE_URL`. Comparación tablas/columnas/filas/hashes **no ejecutada**.

Si origen ≠ V7 → **migración delta** controlada (prohibido import total ciego).

## RAW (`fc7cbf8b-7c2c-489f-bd85-72fbd38eca4c`)

- snapshots 20; snap↔raw diffs **0**
- raw rows **9316**
- control: expected=imported=9316, failed=0

## Canonical logical

- assets **94**; aliases **263**
- inventario→identifier **94/94**
- furgonetas/gse uncovered **0/0**
- tasks null group (aprobado) **20**; bad FK **0**
- orphan incidents **0**; logical dups **0**
- smoke **0**; movements_no_tool **0**
- RPC relation ok=true; cleanup ok=true
- pipeline-p0 exit=0; residues ok=true

## Naive parity

FAIL 115 P0 = auditoría 1:1 pre-merge. Hueco lógico post-F11: **0**.

## Bloqueo cierre

1. Credencial Postgres legacy.
2. Diff live vs V7.
3. Delta si drift.
4. Re-verificar SOURCE=RAW=CANONICAL.
