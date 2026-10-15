# 07 — Preparación para producción (2026-10-14)

**Veredicto: `PARTIALLY READY`.** Todo lo verificable en local pasa (lint, tsc, 57 unit, integración, build, 57 E2E con dos re-ejecuciones justificadas, 176 capturas revisadas). Los gates que dependen del proyecto remoto siguen **bloqueados por red** y requieren aprobación humana; no se declara READY.

## Gates

| Gate | Estado | Evidencia / bloqueo |
|---|---|---|
| TypeScript, lint, build | ✅ | `06-qa-evidence.md`; `next build` compila las 12 rutas `/broki/*` + `/registrobroki` |
| Unit + integración | ✅ 57/57 · Deno suites (+ allowlist de estado) + smoke offline 12/12 | idem |
| E2E local | ✅ 61/61 pass en una sola pasada (tick 2; incluye flujos de concurrencia, Realtime entre sesiones, CRUD aviones y toggle de tarea) | `06-qa-evidence.md` |
| QA visual | ✅ 0 errores consola, 0 overflow tras correcciones; dark/light revisados | `02-ux-ui-audit.md` pasada 2 |
| Paridad legacy | ✅ 62 ítems: 38 FULL_PASS, 22 INTENTIONAL_IMPROVEMENT, 1 BLOCKED (WhatsApp, fuera de alcance), 1 N/A (exportación XLSX inexistente en legacy y Next), 0 UNVERIFIED (ver `01-legacy-feature-matrix.md`) | — |
| Migraciones remotas | ⛔ pendientes de `db push`: `20260810200000_broki_user_access_rls.sql` (corregida, nunca aplicada en remoto), `20261014120000_broki_tooling_condition.sql`, `20261014150000_broki_incident_open_guard.sql` (trigger, tolera duplicados legacy) y `20261014160000_broki_personnel_column_privileges.sql` (privilegios por columna) | sin DNS; requiere aprobación |
| Edge Functions remotas | ⛔ pendientes de deploy: `equipment-update`, `incidents`, `planner-action`, `tooling-action`, `nitro-stock`, `personnel-list` (contratos nuevos: `expected_updated_at`, 409 `incident_already_open`, `dry_run`, `complete_*`, validaciones servidor, sin PII) | idem |
| RLS / RBAC aplicados en remoto | ⛔ no verificable | `security/rls-matrix.md` describe el objetivo; local ✅ |
| Rotación de secretos | ⛔ no ejecutada (prohibida sin coordinación) | `security/secret-rotation-plan.md` |
| Dual-write / n8n | ✅ sin cambios; el dashboard no llama a n8n (E2E) ; WA inbound sigue con flag off | — |
| Datos remotos (conteos, huérfanos) | ⛔ no verificable hoy | `data-audit/19-independent-verification.md` como última referencia |
| Rollback | 🟡 `release/rollback-runbook.md` existente; las dos migraciones nuevas son `create or replace`/`create table if not exists` (reversibles sin pérdida de datos) | — |

## Orden de cutover propuesto (requiere aprobación)

1. `supabase db push` (cuatro migraciones) y verificación de `broki_has_dashboard_access()` con un usuario sin fila en `broki_user_access` → 403.
2. Deploy de las 4 EF modificadas; smoke `npm run test:remote` (crea y limpia residuos QA).
3. Deploy de `web/` (Vercel) con `NEXT_PUBLIC_*` remotos; `npm run test:e2e:release` con credenciales de QA remotas.
4. Captura de verificación de las 12 rutas en producción (`web/scripts/qa-screenshots.mjs` con `E2E_BASE_URL` remoto).

## Riesgos abiertos

- Revisión independiente (06 → “Revisión independiente”): corregidos 3/3 P0 y 17/20 P1 en local; pendientes P1-17 (anti‑replay del canal de servicio) y P1-23 (rotación del `service_role` presente en `web/.env.local`).

- **Compatibilidad de contrato**: la UI nueva envía `expected_updated_at`, `complete_out/in`, `destino`, `dry_run`; contra EF antiguas los campos extra se ignoran (sin rotura), salvo la previsualización PDF (`dry_run`) que importaría de verdad → desplegar EF antes que la web.
- Grupos del planner creados por la UI antigua con `hora_salida` suelta nunca se persistieron (G-15): no hay datos corruptos, pero puede haber grupos “perdidos” que los operadores creían creados.
- Sin E2E de concurrencia a dos sesiones (409 `stale_update`) ni de Realtime entre sesiones.

## Git

- Rama `feat/broki-modernization` @ `fed84e3`; **≈270 ficheros sin commit** (trabajo de las fases anteriores + este). No se ha hecho commit ni push: pendiente de decisión del propietario (recomendado: commit por bloques, PR hacia `main`, nunca merge directo).
