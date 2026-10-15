# 04 — Gaps funcionales y defectos

Origen: inspección de código Next/EF + auditorías legacy (Fase A, 2026-10-11). **Estado actualizado 2026-10-14** tras Fases B–D; evidencia en `06-qa-evidence.md`.

Leyenda estado: ✅ cerrado con evidencia local · 🟡 implementado, evidencia parcial · ⛔ bloqueado externo · ⏳ pendiente.

## P0 — operativa diaria, pérdida de datos, seguridad

| # | Módulo | Gap / defecto | Causa real | Acción aplicada | Estado |
|---|---|---|---|---|---|
| G-01 | Mapa | `/broki/mapa` pintaba un rectángulo gris | Imágenes legacy (82 MB) nunca copiadas; `L.rectangle` | WebP 2400×3399 + `-sm` en `web/public/maps/`; `L.imageOverlay` CRS.Simple; leyenda por estado (D/U/I/?), forma por tipo, toggle “solo en uso”, listas posicionados / sin posición; terminal inicial = la que más equipos tiene | ✅ captura `*_broki_mapa` |
| G-02 | Tooling | Errores de check-out/in tragados | sin estado de error | `ApiError` con código; `InlineError` en modal; modal no cierra en fallo; 409 `open_checkout_exists` traducido | ✅ E2E tooling |
| G-03 | Tooling | Sin estado sacada/devolución; catálogo sin estado | formularios sin radios; RPC no aceptaba `complete_*` | Migración `20261014120000_broki_tooling_condition.sql` (RPC acepta `complete_out/in`), radios Completa/Defectuosa, badge Disponible/Sacada/U-S, aviso al sacar U/S, opción deshabilitada si ya sacada | ✅ E2E tooling |
| G-04 | Stock N₂ | Guardado silencioso, todo o nada, sin validación | sin error UI | `lib/stock/nitro.ts` (dedupe por ubicación, enteros ≥0) + test; solo filas cambiadas; error por fila; Realtime no pisa el borrador | ✅ E2E stock |
| G-05 | Equipos | Edición concurrente pisaba | sin `updated_at` | `expected_updated_at` → 409 `stale_update` (EF, update condicional) · modal “Cargar versión actual” | ✅ E2E a dos sesiones (`flows.spec`) |
| G-06 | Equipos | Estado texto libre / no editable; ubicación habitual no editable | modal sin select | `SelectField` con estados canónicos (furgo y GSE), ubicación habitual y parking separados y editables, errores por campo, datalist avión/operario | ✅ E2E edición + gse-parking |
| G-07 | KPIs | Lógica duplicada en 5 sitios | sin módulo común | `lib/equipment/kpis.ts` consumido por KpiWidgets, analítica, incidencias, sidebar, alertas, filtro `issues` | ✅ `kpis.test.ts`, `filters.test.ts` |
| G-08 | Incidencias | id cliente → colisión 23505 → 500 | EF usa `incident_id` del cliente | EF: una abierta por equipo (409 `incident_already_open`, la UI adopta la existente); reintento con sufijo servidor en colisión; UI usa el código devuelto | ✅ E2E incidencia abrir/listar/resolver |
| G-09 | Aviones | “Equipos asociados” vacío por defecto | filtros persistidos (`avion`/`family`) inexistentes | `FilterBar` sanea filtros persistidos y muestra chips; vista agrupada por avión (paridad “Operativa por Avión”) + cuadrícula | ✅ captura `*_broki_aviones` |
| G-10 | Alertas | Campana sin inoperativos ni N₂<500 | `buildCriticalAlerts` incompleto | reglas legacy completas (≤3 individuales / resumen, N₂ 0<p<500) | ✅ `buildCriticalAlerts.test.ts` |
| G-11 | Planner | tareas deduplicadas por descripción | clave `codigo ?? descripcion` | clave = id DB; vínculo por `group_id` con fallback matrícula+día | ✅ `mappers.test.ts` |
| G-12 | Planner | hora de llegada ausente | `WorkGroup` sin `llegada` | `llegada` (ETA / En base / Pre-vuelo) en card | ✅ captura planner |
| G-13 | Seguridad | RLS/`broki_user_access` sin confirmar en remoto | remoto inalcanzable | migración aplica limpia en local y gobierna el acceso del usuario QA (403 sin fila) | ⛔ remoto BLOCKED_EXTERNAL |
| G-14 | Errores | fallo de carga → pantalla vacía | sin estado `error` | `ErrorState` con reintentar en planner, tooling, stock, horario, relevos, aviones, analítica, listados | ✅ |
| **G-15 (nuevo)** | Planner | **Crear asignación fallaba siempre** desde la UI: la RPC castea `"10:00"` y `"BASE"` a `timestamptz` → `db_error` | columna timestamptz + cliente enviando hora suelta | `lib/planner/time.ts`: día + hora → ISO; BASE/PRE → `destino`; mapper lee `destino` | 🟡 corregido; E2E en ejecución |
| **G-16 (nuevo)** | Dev/E2E | Next 16 bloqueaba assets/HMR para `127.0.0.1` → la app no hidrataba en `npm run test:e2e` | `allowedDevOrigins` ausente | añadido en `next.config.ts` | ✅ |

## P1 — utilidad relevante

| # | Módulo | Gap | Acción | Estado |
|---|---|---|---|---|
| G-20 | Shell | Selector de tema | menú de usuario (6 temas legacy) | ✅ (ya existía; lint corregido) |
| G-21 | Shell | Notificaciones de navegador | opt-in en la campana; `lib/notifications/browserNotify.ts` (congelación, fuel<10, incidencia; throttle 60 s/clave) | ✅ test unitario; manual pendiente (requiere permiso del navegador) |
| G-22 | Planner | Selector de día | `DateSelector` + `mergePlannerData({ day })` | ✅ test |
| G-23 | Planner | Previsualización PDF | `planner-action` `dry_run=1` → tareas; UI previsualiza antes de crear | 🟡 E2E en ejecución |
| G-24 | Roster | Día seleccionable, filtro aerolínea en ambas vistas | `DateSelector` (semana/día), cabeceras de día clicables, ausencias | ✅ captura |
| G-25 | Incidencias | Lista global con fechas/técnico | tabla con búsqueda y filtro abiertas/resueltas, acceso al equipo | ✅ E2E |
| G-26 | Mapa | Solo en uso, un color, sin lista | ver G-01 | ✅ |
| G-27 | Tooling | Búsqueda solo catálogo; sin filtros | búsqueda en los 3 tabs (BAC, descripción, P/N, S/N, técnico, avión); filtros estado/tipo | ✅ |
| G-28 | UX | `confirm()`/`alert()` | `ConfirmDialog` en planner (grupo/tarea), aviones, relevos | ✅ E2E planner delete |
| G-29 | A11y | selects sin label, botones icono sin nombre, `<dialog open>` sin focus trap | `FilterSelect`, `IconButton` con `label` obligatorio, `Modal` único | ✅ |
| G-30 | Meteo | 2 fetch | `useLemdWeather` (caché 10 min compartida) | ✅ |

## P2 — pulido

| # | Gap | Acción | Estado |
|---|---|---|---|
| G-40 | Atajos Ctrl+1..9 y Ctrl+? | layout + `ShortcutsHelp` | ✅ |
| G-41 | Secciones colapsables | no implementado (sin demanda operativa) | ⏳ |
| G-42 | `lastUpdate` relativo | tick 15 s en Topbar | ✅ |
| G-43 | import sin usar | eliminado | ✅ |

## Deuda histórica (estado 2026-10-14)

| Ítem | Estado |
|---|---|
| Migración sin certificar vs PostgreSQL fuente | ⛔ BLOCKED_EXTERNAL (sin `LEGACY_DATABASE_URL`, sin DNS) |
| Dual-write HTML/n8n vs Next/Supabase | sin cambios: n8n intacto, flag WA off, el dashboard no llama a n8n (E2E “none of them calls n8n” ✅) |
| RLS pendiente en remoto | ⛔ BLOCKED_EXTERNAL; local ✅ |
| Rotación de secretos | no ejecutada (requiere coordinación) |
| E2E release incompletos | suite local 57 tests (ver 06); `test:e2e:release` contra remoto ⛔ |
| Tooling checkout/checkin en navegador | ✅ E2E completo (sacada → bloqueo duplicado → devolución → historial) |
| Planner PDF / roster | 🟡 PDF: previsualización + import E2E en ejecución; roster: import E2E ✅ |
| Aviones equipos asociados vacío | ✅ causa (filtros persistidos) corregida |
| Relaciones huérfanas | datos remotos no verificables; el mapper ya no deja tareas huérfanas visibles (vínculo por `group_id`) |
| Diferencias visuales HTML vs Next | Fase B aplicada a las 12 rutas (ver 02 y capturas) |
| WhatsApp | fuera de alcance; intacto |
