# FASE 20 — Browser QA (sesión IDE)

**Fecha:** 2026-08-10  
**URL:** `http://localhost:3000/broki`  
**Usuario:** `userdemo@gmail.com`  
**Veredicto UI:** **PASS WITH GAPS** (no sustituye gates F20 / NOT READY)

## Resumen

Shell y rutas principales cargan con datos live (94 equipos, Realtime/Polling, badge notificaciones). CRUD incidencias OK. Persistencia edit furgoneta OK (nota QA limpiada). Tooling checkout/checkin ciclo completo y exports planner/roster **no** ejercidos end-to-end (evitado residuo / sin PDF).

## Matriz

| Área | Resultado | Evidencia |
|------|-----------|-----------|
| Shell / nav / Realtime | **PASS** | Badge 18, status Realtime/Polling/Online, menú 12 rutas |
| Notificaciones | **PASS** | Panel alertas; badge 18→19 al abrir incidencia→18 al resolver |
| Furgonetas | **PASS** | 17 vans; L1-3 edit notas `QA-BROWSER-20260810` persistió; cleanup confirmado (sin QA en modal) |
| GSE list + modal | **PASS** | Lista + familias; BRK-126 modal |
| GSE parking vs ubicación | **PASS** (dato) | Campos separados: `Ubicación habitual` = `GSE AREA PARKING 70 T 1,2,3`, `Parking` = `-` |
| Nitrógeno (presiones en card) | **PASS** | BRK-126/335/442 muestran PSI en tarjeta |
| Aviones — Registro flota | **PASS** | ~18 filas Editar/Eliminar + Nuevo |
| Aviones — Equipos asociados | **WARN** | Default vacía (“Sin resultados”) con filtros en all |
| Incidencias list | **PASS** | Empty state limpio |
| Incidencias CRUD | **PASS** | Create+resolve en BRK-126; historial conserva texto QA |
| Planner | **PASS** (carga) | Día 10 ago; asignación **ECNFP** “Sin tareas” (órfano conocido F20) |
| Planner PDF/XLSX | **SKIP** | No ejercido |
| Roster / Horario | **PASS** (UI) | Controles semana/PDF drop; sin upload |
| Relevos (`/fleet`) | **PASS** | Empty “Sin Relevos Activos” + CTA |
| Stock Nitrógeno | **PASS** | Totales 17 llenas · 12 vacías; zonas T1,2,3 / T4S + GSE nitro |
| Tooling list | **PASS** | Catálogo 344, Sacadas 1, Devueltas 2 |
| Tooling checkout modal | **PASS** | Form BAC/TMA/avión; Cancelar sin write |
| Tooling checkout/checkin E2E | **SKIP** | No sacada real (evitar residuo) |
| Mapa | **PASS** | Tabs T1–T3 / T4 / T4S |
| Analytics | **PASS** | 94 / 78 / 7 / 8 + alertas nitro + fuel vans |
| Mobile nav | **PASS** | Drawer con todos los links |
| Sesión / logout visible | **PASS** | Menú “Cerrar sesión”; **no** se cerró sesión |
| Logout real | **SKIP** | Conservar sesión QA |
| Realtime update externo | **SKIP** | Sin write externo controlado |

## Residuos

| Ítem | Estado |
|------|--------|
| Nota L1-3 `QA-BROWSER-20260810` | **Limpiada** |
| Incidencia BRK-126 `QA-BROWSER-INC-20260810` | **Resuelta**; queda en historial del asset (esperado) |
| Tooling / relevos / roster | Sin writes nuevos |

## Gaps → no READY

1. Exports planner / upload roster no probados en browser.
2. Tooling checkout→checkin no cerrado.
3. Aviones “Equipos asociados” vacío por defecto (UX/datos).
4. Planner órfano ECNFP (alineado con orphan_groups F20).
5. Gates F20 siguen bloqueando prod (auth RLS remoto, secrets rotation, E2E release, source parity, dual-write WA).

## Conclusión

UI operativa con sesión demo. **No** eleva F20 a READY. Siguiente: cleanup historial QA opcional; completar skips; gates humanos F20.
