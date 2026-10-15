# 06 — Evidencia de QA (2026-10-14, local)

Entorno: Supabase local desechable `127.0.0.1:55321/55322` (29 migraciones + `seed.sql`), `functions serve`, Next dev `:3100`, usuario QA `qa@broki.test` (admin). Ninguna prueba toca el proyecto remoto. Reproducción: ver `00-current-baseline.md` → Entorno y los comandos de abajo.

## Checks estáticos y unitarios

| Check | Comando | Resultado |
|---|---|---|
| Lint | `npm run lint` (web) | 0 errores, 0 warnings (baseline tenía 1 error + 1 warning) |
| TypeScript | `npx tsc --noEmit` | limpio |
| Deno check EF modificadas | `deno check supabase/functions/{equipment-update,incidents,planner-action,tooling-action}/index.ts` | limpio (corregido un TS2345 preexistente en planner-action) |
| Unit (node --test) | `npm run test:unit` | **57/57** (baseline 25/25). Nuevos: `buildCriticalAlerts.test` (6), `validators/equipment.test` (5), `stock/nitro.test` (4), `mappers/tooling.test` (3), `notifications/browserNotify.test` (2), `planner/time.test` (3), `filters.test` (+1), `mappers.test` planner (4 casos reescritos) |
| Integración (Deno, offline) | `npm run test:integration` | todas las suites pass; smoke offline 12/12 |
| Build | `npm run build` | ver `07-release-readiness.md` (resultado del build de hoy) |

## E2E Playwright (57 + 4 tests, 1 worker, Chromium)

Comando: `E2E_BASE_URL=http://127.0.0.1:3100 E2E_EMAIL=qa@broki.test E2E_PASSWORD=… SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx playwright test --reporter=line` (desde `web/`).

Última ejecución completa (tick 2, tras la revisión independiente, 61 tests incl. `flows.spec.ts`): **61/61 pass en 2,1 min, una sola pasada**; `npm run build` OK. Historial de la pasada anterior (57 tests): 54 pass / 3 fail re-ejecutados aislados:

| Test | Resultado final | Nota |
|---|---|---|
| planner PDF previewed and imported | ✅ (re-run) | el test aseveraba antes de que el modal cerrara (strict mode); corregido el test |
| nitrogen stock can be edited | ✅ (re-run) | el valor aleatorio coincidió con el guardado → “Sin cambios”; el test ahora elige un valor distinto |
| registration accepted once / duplicate | ⚠️ pasó en la 1.ª ejecución; en la 3.ª del día devolvió **429 “Demasiadas solicitudes”** (rate limit por IP/hora de `personnel-register`, protección deseada) | `SKIPPED-by-rate-limit`, no es fallo de producto |

Suite añadida en el tick 2, `e2e/flows.spec.ts` (**4/4 pass** en 16 s): completar/reabrir tarea con persistencia tras recarga; CRUD de avión (alta, duplicado 409 visible, edición, borrado confirmado); conflicto de edición concurrente a dos sesiones (409 `stale_update`, nada sobrescrito, “Cargar versión actual”); cambio hecho en una sesión visible en otra **sin recargar en 6 s** (Realtime, no el polling de 30 s).

Cobertura por recorrido del prompt (§13):

| # | Recorrido | Test | Estado |
|---|---|---|---|
| 1 | Login válido | acceptance 1, broki login helper | ✅ |
| 2 | Acceso no autorizado | broki “anonymous visitor is sent to login”; `broki_user_access` deny-by-default (EF 403 sin fila) | ✅ |
| 3 | Dashboard | acceptance 2, broki “every route renders… none calls n8n” | ✅ |
| 4 | Búsqueda | acceptance 6 (persistencia `broki_filters`) | ✅ |
| 5 | Filtrado | `filters.test.ts`; chips/saneado por inspección + capturas | ✅ unit / 🟡 sin E2E dedicado |
| 6 | Edición furgoneta | broki “record can be edited and the change sticks” (reload desde Postgres) | ✅ |
| 7 | Edición GSE | `gse-parking.spec` (parking ≠ ubicación habitual, persistido) | ✅ |
| 8 | Alta y resolución de incidencia | broki “incident can be opened, listed and resolved” | ✅ |
| 9 | Aeronave ↔ equipos | captura vista “Por avión”; flows “aircraft can be created, edited, refused as duplicate and deleted” | ✅ |
| 10 | Grupo planner | broki “planner assignment can be created and deleted” (persistencia tras reload + ConfirmDialog) | ✅ (tras corregir G-15) |
| 11 | Importación PDF planner | broki “PDF is previewed and then imported” (dry run + import, fixture `e2e/fixtures/pdf.ts`) | ✅ |
| 12 | Completar tarea | flows “task can be completed and reopened, and the state survives a reload” | ✅ |
| 13 | Subida horario | broki “roster PDF is imported” (MARIO LORENZO 07:00-19:00 tras recarga) | ✅ |
| 14 | Semanal / diaria | acceptance 19 + capturas `roster-daily` | ✅ vista / 🟡 sin E2E de cambio de día |
| 15–16 | Alta y persistencia de relevo | broki “relay survives reload and a new browser context” | ✅ |
| 17 | Nitrógeno | broki “nitrogen stock can be edited” | ✅ |
| 18–19 | Tooling checkout / checkin | broki “tool can be checked out and back in” (+ bloqueo de doble sacada + historial) | ✅ |
| 20 | Terminales del mapa | acceptance 15 + capturas por terminal | ✅ |
| 21 | Navegación móvil | acceptance 25 (dashboard y marketing) | ✅ |
| 22 | Cierre de sesión | acceptance 28 | ✅ |
| 23 | Estados sin datos | `EmptyState` en todas las listas (capturas con listas vacías: posicionados en T4, historial) | 🟡 sin E2E con BD vacía |
| 24–25 | Fallo de red / recuperación | acceptance 12 (500 forzado → error visible); `ErrorState` + reintentar por inspección | 🟡 |
| 26 | Realtime entre dos sesiones | flows “change made in one session appears in another without reloading” (6 s) + “concurrent edit is refused with a stale-update conflict” | ✅ |

## QA visual

- `web/scripts/qa-screenshots.mjs`: 130 capturas (13 rutas × 5 anchos × 2 temas) → `report.json`: **0 errores de consola**, overflow horizontal detectado en 56 capturas en la 1.ª pasada → corregido (`min-width:0`, topbar) → sonda posterior a 360/390/768/1024: **0 overflow**.
- `web/scripts/qa-interactions.mjs`: 46 capturas de modales, menú móvil, campana, edición.
- Revisión crítica y correcciones en `02-ux-ui-audit.md` (pasada 2, V-01…V-09).
- Hidratación: sonda con todas las preferencias persistidas (dark, compacto, auto-refresco off, notificaciones, filtros, tema): consola limpia y sin badge de issues de Next.

## Datos (local)

- `seed.sql` + residuos controlados: los tests limpian lo que crean (relevo, grupo planner, movimiento tooling, incidencia resuelta queda en historial por diseño); `broki_assets` FURGO-01 conserva la última ubicación escrita por el test de edición.
- Integridad remota (conteos, huérfanos, RLS aplicada): **BLOCKED_EXTERNAL** (sin DNS). Ver `07-release-readiness.md`.

## Revisión independiente (Fase E, tick 2 — agente distinto del implementador, solo lectura)

46 hallazgos (3 P0, 20 P1, 23 P2) + lista de tests tautológicos. Triaje y estado:

| # | Hallazgo | Acción | Estado |
|---|---|---|---|
| P0-1 | El token `expected_updated_at` se refrescaba por Realtime entre “Editar” y “Guardar” → el 409 nunca saltaba en uso real | `draft.expectedUpdatedAt` congelado al iniciar la edición (modal) y `editTokens` por ítem (stock) | ✅ flows “stale-update conflict” |
| P0-2 | “Una incidencia abierta por equipo” era select‑then‑insert sin constraint | migración `20261014150000_broki_incident_open_guard.sql`: trigger BEFORE INSERT con `pg_advisory_xact_lock` por `id_objeto` (tolera duplicados legacy); EF mapea a 409 `incident_already_open` | ✅ aplicada en local |
| P0-3 | Open‑Meteo con error → “0 °C” → falsa alerta crítica de congelación + notificación | `res.ok` y `temperature_2m` numérico obligatorios; si no, `UNAVAILABLE` | ✅ |
| P1-4 | XSS almacenado en tooltips del mapa | `esc()` en todo el HTML del tooltip | ✅ |
| P1-5 | `datalist` solo existía dentro del formulario de equipo | `AutocompleteLists` montado en el layout | ✅ |
| P1-6 | Furgoneta sin lectura de combustible → “100 % (ok)” | `fuel: null` (UI muestra “Sin lectura”); test corregido | ✅ `mappers.test` |
| P1-7 | `useBrokiRealtime` degradaba a polling a los 5 s aunque hubiera SUBSCRIBED; `useEquipment` etiquetaba “Polling” tras el primer tick | fallback no‑op tras SUBSCRIBED; `setSyncMode` funcional conserva `realtime` | ✅ |
| P1-8 | `PlannerCreator` conservaba borrador/PDF/preview entre aperturas | remount con `key` en cada apertura | ✅ |
| P1-9 | Día del planner = `fecha_modificacion`; crear siempre es “hoy” | documentado como INTENTIONAL (sin columna de fecha operativa); el selector es de consulta | 📝 |
| P1-10 | Checkout concurrente de tooling → 500 | `23505` → 409 | ✅ |
| P1-11 | Timestamps del navegador persistidos | `now()` de servidor en incidencias, tooling y creación de grupos | ✅ |
| P1-12 | `estado` texto libre en servidor | allowlist canónica en `equipment-validate` (se permite conservar el estado legacy actual) | ✅ self‑check Deno |
| P1-13 | `update/close_incident` por `incident_code` sin equipo ni estado | filtra `id_objeto` + `estado=1`; cerrar dos veces → 404 | ✅ |
| P1-14 | `nitro-stock` sin validación servidor | enteros 0–9999 y ubicación saneada | ✅ |
| P1-15 | Mensajes crudos de Postgres en import PDF | mensaje genérico | ✅ |
| P1-16 | PII de personal visible a cualquier rol | `personnel-list` elimina teléfono/correo/raw_payload; migración `20261014160000_broki_personnel_column_privileges.sql` (privilegios por columna para `authenticated`): verificado por REST con el usuario QA → `select=*` y `telefono` → 42501, `nombre,n_bac` → OK | ✅ |
| P1-17 | Service‑auth sin anti‑replay | canal de servicio no usado por el dashboard; se mantiene como deuda documentada | ⏳ |
| P1-18 | Toggle de tarea sin guard; `estado` sin validar | `if (saving) return`; EF exige 0/1 | ✅ |
| P1-19 | Rollback optimista pisaba otros equipos / closures stale | rollback por ítem; `patchIncidentState` funcional; `setAircraft` | ✅ |
| P1-20 | Guardado parcial de presiones reenviaba filas ya guardadas; sin tope 6000 | ids guardados salen del borrador; tope 6000 | ✅ |
| P1-21 | GSE: `matricula`, `plazas`, `adblue`, `combustible` no visibles/editables | mapeados y mostrados cuando existen; combustible editable en GSE motorizados (misma regla que KPIs) | ✅ |
| P1-22 | Fecha del día calculada en SSR (TZ servidor ≠ cliente) | subtítulo con fecha solo tras hidratar | ✅ |
| P1-23 | `SUPABASE_SECRET_KEY` remoto en `web/.env.local` | gitignored y no importado por la app; **rotación pendiente de coordinación** (ver 07) | ⏳ |
| P2-24/25 | `<button>` con `<h3>`/`role=list`; `aria-label` en `div` | `EquipmentCard` = `article` con botón “stretched” dentro del `h3` (toda la tarjeta clicable, objetivo accesible = id); botellas con `role=img` | ✅ tick 3 |
| P2-26/27/28 | Tabs sin flechas; menú móvil sin Escape; modales anidados cerraban ambos con Escape | Escape cierra el menú móvil; pila de modales; tablists con flechas/Home/End y tabindex itinerante (`lib/a11y/tablist.ts`) en aviones, horario, mapa y tooling | ✅ tick 3 |
| P2-29 | Handler `dialog[open]` muerto; Ctrl+K enfocaba el buscador oculto en móvil | enfoca el buscador visible; handler eliminado | ✅ |
| P2-31 | Tooling parpadeaba en cada refresco Realtime | skeleton solo en carga inicial | ✅ |
| P2-32 | Subir PDF de la misma semana no recargaba | recarga si la semana no cambia | ✅ |
| P2-33 | Zonas solapadas heredadas del legacy; `getMapPosition` toma el primer número | heredado del legacy (MAP‑04 reclasificado INTENTIONAL con la salvedad) | 📝 |
| P2-34 | Analítica contaba botellas a 0 como “presión baja” | `0 < p < 1000` como la campana | ✅ |
| P2-36 | Fallo parcial de carga vaciaba el dashboard | se conservan las listas anteriores; solo cambia lo recibido | ✅ |
| P2-37/38 | `refreshRegistry` sin catch; notas de devolución pisaban las de salida | catch + `setAircraft`; `remarks` partido en “out \| in” | ✅ |
| P2-30/35/39–46 | historial del modal, quitar PDF, CORS `broki*.vercel.app`, `relays` id no UUID, campos sin acotar en `aircraft-action`/`update_group`, import concurrente del mismo PDF, `complete_*` libre (ahora allowlist en EF ✅), `getInitialFilters` no lazy (✅) | resto pendiente, no bloqueante | ⏳ |

Tests tautológicos señalados → reescritos: tema (usa el selector y persiste), shell (12 enlaces + `aria-current` navegando), mapa (cambio de terminal + 2 pins + listas), analítica (total coincide con el dashboard + donut), PWA (`sw.js` + `/offline`), campana (abre el panel y comprueba FURGO‑02 y E‑07), edición de equipo (campo “Parking actual” y restauración del seed), stock (valor exacto en la definición), Realtime entre sesiones (15 s, por debajo del poll de 30 s).
