# RLS Matrix — BROKI

Migración: `20260810200000_broki_user_access_rls.sql`

## Helper

`broki_has_dashboard_access()` — `security definer`, true si `broki_user_access` activa.

## Clases

| Clase | Tablas (ej.) | authenticated SELECT |
|-------|--------------|----------------------|
| A Realtime ops | assets, incidents, planner_*, nitro, tooling_*, aircraft, personnel, relays, roster_* | solo si `broki_has_dashboard_access()` |
| B/C Sensitive | communications, chat_histories, unknown_contacts, audit_events, marketing_leads | **ninguno** (service_role) |
| D ETL/RAW | legacy_rows, snapshots, import_*, sync_*, idempotency, relation_resolutions, cleanup_audit | **ninguno** |

Policy antigua `"Authenticated users can read" USING (true)` eliminada en esas tablas.

## Nota

Migración **no aplicada automáticamente** en remoto. Requiere `db push` humano.
