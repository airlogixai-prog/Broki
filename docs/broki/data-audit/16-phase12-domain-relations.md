# 16 — Domain relations (texto → UUID)

run_id apply: `8cbfb3d7-0a8d-47a6-b9e5-80ffb7c2075e`

## Reglas

- Exacto único solo: `broki_norm_text` (unaccent+lower+trim) / `broki_norm_code` (upper+trim).
- 2+ candidatos → `MANUAL_REVIEW` (no auto-link).
- 0 candidatos / sin clave fuente → `HISTORICAL_UNRESOLVABLE`.
- No fuzzy, no nicknames, no inventar prefijos (`LZD` ≠ `EC-LZD`).

## Schema

| Cambio | Motivo |
|---|---|
| `broki_personnel.auth_user_id` | auth.users ↔ personnel (email/phone exact) |
| `broki_assets.worker_name_snapshot` | histórico worker texto |
| `broki_assets.aircraft_registration_snapshot` | histórico matrícula texto |
| `broki_incidents.aircraft_id` | vía asset |
| `broki_incidents.planner_task_id` | cuando exista clave (legacy: no) |
| `broki_relation_resolutions` | audit clasificación |
| FKs en `20260810190100_*` | **después** del backfill |

## Before → After

| Métrica | Before | After |
|---|---:|---:|
| recoverable_orphans | 127 | **0** |
| LINKED (apply) | — | 130 |
| MANUAL_REVIEW | — | 0 |
| HISTORICAL_UNRESOLVABLE | — | 247 |

`broki_verify_relation_integrity().ok` = **true**

## Por dominio

- **Personnel↔auth**: 0 linkables (email/phone no coinciden con `auth.users` actuales) → HISTORICAL / no inventar.
- **Assets worker**: 42 exact → UUID; snapshots poblados.
- **Assets aircraft**: exact matricula; typos/`LZD`/`T1` → HISTORICAL.
- **Incidents asset**: ya linked; worker nicknames (`BAYTON`) → HISTORICAL; aircraft vía asset cuando existe; **task** sin clave legacy → HISTORICAL.
- **Planner**: vehicle identifiers exact; members accent-fold exact; responsible no-match → HISTORICAL; tasks `SOURCE_GROUP_NULL` → HISTORICAL (aprobado).
- **Tooling**: tma_out/in exact unique; tool/aircraft ya OK.

## Tests

- `supabase/functions/_shared/relation-match.ts` (self-check)
- `supabase/functions/_tests/relation-match.test.ts` (5 cases) — PASS
- Cableado en `npm run test:integration`

## Artefactos

- `scripts/apply-broki-domain-relations.mjs`
- `supabase/migrations/20260810190000_broki_domain_relations.sql`
- `supabase/migrations/20260810190001_broki_domain_relations_fix.sql`
- `supabase/migrations/20260810190100_broki_domain_relation_fks.sql`
- `docs/broki/data-audit/16-domain-relations-{dry-run,apply}.json`
