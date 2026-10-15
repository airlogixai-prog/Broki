# Inventario de features — legacy BROKI

> Catálogo funcional completo antes de reescritura visual. Sin implementar migración.

## Fuentes y alcance

| Fuente | Rol |
|--------|-----|
| `public_html/broki.html` | **Canónico** — producción Hostinger |
| `public_html/broki2.html` | Snapshot reducido (9 tabs) |
| `public_html/registrobroki.html` | Registro personal |
| https://airlogixai.com/broki.html | Validación live |
| `web/` | Destino migrado (paridad funcional backend, UI en progreso) |
| `PRODUCCION_*.json`, `Desarrollo.json` | No en repo — ver `legacy-network-inventory.md` |
| `_airlogixai.com.zip`, `broki_en_multiarchivos/**` | No en workspace |

---

## 1. Resumen ejecutivo

| Área | Legacy | Next (estado) |
|------|--------|---------------|
| Inventario unificado | ✅ n8n | ✅ Edge Functions |
| 12 tabs dashboard | ✅ SPA | ✅ rutas separadas |
| Auth | ❌ (webhooks abiertos) | ✅ Supabase session |
| PIN planner | ✅ `7378` en fuente | ❌ sustituido por login |
| Relevos | ✅ solo localStorage | ✅ API `relays` |
| Temas ×6 | ✅ | ❌ |
| Notificaciones browser | ✅ | ❌ (solo in-app) |
| Tooling | ✅ | ✅ |
| WhatsApp | n8n separado | `broki-whatsapp-inbound` — **no tocar** |

---

## 2. Core — datos y sincronización

### `fetchData()` / polling

- Intervalo **30s** con toggle `#autoRefresh`
- Normaliza inventario → `state.furgonetas` + `state.gse` via `splitInventory`, `normalizeFurgo`, `normalizeGSE`
- Personal → `normalizePersonal` (acentos, ratings por avión)
- Merge planner groups + tasks en memoria
- Incidencias → `processIncidents`
- Aviones y stock N₂ en estado global

### Funciones de dominio (JS legacy)

| Función | Responsabilidad |
|---------|-----------------|
| `getFamily` | Clasificación GSE por keywords / prefijo ID |
| `getStatusCategory` | Bucket estado operativo |
| `getStatusClass` | Clase CSS tarjeta |
| `calculateGPUFuel` | Combustible GPUs |
| `calculatePressures` | Presiones nitrógeno (carros N₂) |
| `highlightText` | Búsqueda con `<mark>` |
| `removeAccents` | Normalización texto |
| `updateKPIWidgets` / `updateStats` | Dashboard métricas |
| `restoreFilters` / `saveFilters` | Persistencia filtros |

**Next:** lógica en `web/src/lib/mappers/*`, `validators/equipment.ts`, tests unitarios.

---

## 3. Dashboard (`tab: dashboard`)

### Features

- KPIs: total, operativos %, incidencias %, en uso %, combustible bajo, salud flota
- Grid equipos con leyenda (Disponible / En Uso / Incidencia)
- Filtros: estado, avión, familia, búsqueda texto
- Vista compacta (`toggleCompactMode`)
- Widget clima LEMD (`renderWeatherForDashboard`, `fetchRealWeather`)
- Acción rápida salud flota → tab incidencias
- Tarjetas clicables → `openDetail()`

### Estados

- Loading: loader global + skeleton implícito
- Error conexión: banner reintentar
- Vacío: sin equipos → KPIs en 0

---

## 4. Vistas por tipo de equipo

| Tab | Filtro base | Render |
|-----|-------------|--------|
| `furgonetas` | `type === 'furgo'` | `render()` → cards |
| `gse` | GSE | idem + presiones N₂ |
| `aviones` | por avión / parking | `updateAvionSelect`, agrupación |

**Modal detalle** (`openDetail`):

- Editar campos equipo → `sendWebhook` → `UPDATE_EQUIPMENT`
- Sección incidencias: listar, crear, mensajes, cerrar
- Historial uso: `getUsageHistory`
- Notas largas expandibles

**Next:** `EquipmentListPage`, `EquipmentDetailModal`, `IncidentSection`.

---

## 5. Mapa (`tab: mapa`)

- **Leaflet** sobre `#leaflet-map`
- **Mapas estáticos** terminal T4, T4S, T123 con zonas hardcodeadas
- Pins equipos ocupados según parking
- `switchMap` entre terminales

**Next:** mapa estático sin Leaflet; pins CSS hover.

---

## 6. Incidencias (`tab: incidencias`)

- Lista global filtrable
- `filterByIssues()` desde dashboard
- Crear incidencia con worker + texto
- `generateNextIncidentId()` cliente
- POST `REPORT_INCIDENT`
- Estados: abierta/cerrada, historial en modal

**Next:** `incidencias/page.tsx` + API `incidents`.

---

## 7. Analítica (`tab: analytics`)

- ApexCharts: estado flota, composición familia, combustible crítico
- `renderAnalytics()` al entrar tab
- Datos desde `state` en memoria (no fetch extra)

**Next:** `analytics/page.tsx` — validar paridad gráficos.

---

## 8. Planner (`tab: planner`)

### Flujo

1. Botón "Nueva Tarea" → `requestCreatorAccess()` → **PIN `7378`**
2. Panel creador: upload PDF hoja trabajo
3. Parse tareas → `parsed-tasks-container`
4. Formulario: matrícula, modelo, aerolínea, salida/llegada, responsable, operarios multi-select, furgoneta
5. `createAssignment()` → `sendWebhook` → `PLANNER_CREATE`
6. Pizarra: grupos del día, toggle tarea, delete task, complete assignment

### Seguridad legacy

- PIN de 4 dígitos en HTML — **obfuscación cero**
- Next: comentario explícito en `planner/page.tsx` — sesión Supabase basta

### PDF

- Drag & drop + click `#pdf-dropzone`
- Extracción texto PDF en cliente (misma familia lógica que `_shared/planner-parse.ts`)

---

## 9. Roster (`tab: roster`)

- Upload PDF horario → `UPLOAD_ROSTER` multipart
- Vista semanal: tabla Lun-Dom, columnas cert/nombre/shifts
- Vista diaria: `setRosterMode('daily')`
- Filtro aerolínea: Todos / Iberojet / World2Fly
- Estilos turno: `getShiftStyle`

**Next:** `roster/page.tsx` + `roster-upload` function.

---

## 10. Flota / Relevos (`tab: fleet`)

- Libro relevos por avión
- Modal crear: avión, técnico, puntos dinámicos (`addRelayPoint`)
- Persistencia **`localStorage.relays_db` únicamente**
- Delete: `deleteRelay(idx)`

**Next:** `fleet/page.tsx` + API `relays` (persistencia servidor) — **cambio de comportamiento**.

---

## 11. Stock nitrógeno (`tab: stock`)

- Lectura `GET_NITRO_STOCK`
- Tarjetas por ubicación/terminal
- Modo edición: botellas llenas/vacías
- Guardar → webhook nitro (`sendWebhook`)

**Next:** `stock/page.tsx` + `nitro-stock` function.

---

## 12. Tooling (`tab: tooling`)

### Features

- Catálogo herramientas (GET `tooling`)
- Movimientos (GET `registro_tooling`)
- **Check-out:** persona (autocomplete personal), avión, herramienta BAC, notas
- **Check-in:** herramienta prestada, BAC devolución, notas
- Secciones colapsables
- Tabla movimientos actualizada
- Custom aircraft: `#checkout-aircraft-custom`
- Protección render: IIFE evita que `render()` pise tooling

### Endpoints dedicados

Ver `legacy-network-inventory.md`.

**Next:** `tooling/page.tsx` — UI densa migrada.

---

## 13. Notificaciones y alertas

### Campana in-app

- `getCriticalAlerts()` async
- Tipos: clima ≤0°C, previsión hielo, combustible <25%, incidencias críticas, mantenimiento
- `updateNotifications()` cada 2 min + al abrir dropdown
- Click alerta → `cambiarTab(...)` + `closeNotifications()`

### Browser notifications

- `requestNotificationPermission()` al inicio
- `sendBrowserNotification()` con throttle 60s/tipo
- `checkAndNotify()` interval 120s

**Next:** `NotificationsBell` + `buildCriticalAlerts.ts` — sin Web Notifications.

---

## 14. Registro personal (página separada)

**Ruta:** `registrobroki.html` → Next `/registrobroki`

### Campos

- Datos personales: nombre, teléfono, email, código AENA, departamento
- Certificaciones: helper, cat_a, b1, b2, certificador
- Nº BAC (obligatorio si cert técnico)
- Matriz aeronaves × certificaciones (10 modelos)
- Privacidad + honeypot
- Metadata: timestamp, user-agent, bloque legal Airlogix

### Envío

- POST `https://n8n.airlogixai.com/webhook/registro_broky`
- Next: `personnel-register` Edge Function + validación servidor

---

## 15. Temas, accesibilidad, UX global

| Feature | Legacy |
|---------|--------|
| Dark mode | toggle + persistencia |
| 6 color themes | dropdown |
| Compact grid | toggle |
| Búsqueda highlight | sí |
| Atajos teclado | Ctrl+K, /, Ctrl+R, Esc, Ctrl+1-9, Ctrl+? |
| Auto-refresh | 30s |
| PWA manifest | `standalone`, icon 512 |
| Mobile menu | slide sidebar |
| Hover tooltips | topbar iconos |

---

## 16. `broki2.html` — subset funcional

Presente: dashboard, mapa, furgonetas, gse, aviones, incidencias, analytics, planner, roster, PIN, leaflet, apexcharts, weather.

**Ausente:** fleet, stock, tooling, notificaciones, compact mode, theme dropdown, endpoints aircraft/roster/nitro.

Útil como snapshot histórico **no** representativo de producción actual.

---

## 17. Funciones JavaScript inventariadas (broki.html)

```
CardComponent, EmptyState, SectionHeader, calculateGPUFuel, calculatePressures,
checkAndNotify, closeNotificationsOnClickOutside, closeThemeSelectorOnClickOutside,
createAssignment, fetchData, fetchRealWeather, generateNextIncidentId,
getCriticalAlerts, getFamily, getIncidents, getMapPosition, getPriorityColors,
getShiftStyle, getStatusCategory, getStatusClass, getUsageHistory,
handleToolingCheckin, handleToolingCheckinBACInput, handleToolingCheckout,
handleToolingCheckoutBACInput, handleToolingCustomAircraft, handleToolingPersonInput,
highlightText, initTooling, initToolingAutocomplete, loadAircraftList,
loadPersonnelList, loadToolCatalog, loadToolingMovements, normalizeFurgo,
normalizeGSE, normalizePersonal, openDetail, openRelayModal, populatePlannerOptions,
populateToolingAircraftSelect, preventDefaults, processIncidents, removeAccents,
render, renderAlert, renderAnalytics, renderFleet, renderMap, renderPlanner,
renderRoster, renderStock, renderTooling, renderWeatherForDashboard,
requestNotificationPermission, restoreFilters, saveFilters, selectToolingCheckinTool,
selectToolingCheckoutTool, selectToolingPerson, sendBrowserNotification,
sendGroupWork, sendWebhook, setLoading, setSystemStatus, showFileSelected,
startAutoRefresh, stopAutoRefresh, switchMap, toggleToolingSection,
updateAvionSelect, updateFamilyList, updateKPIWidgets, updateNotifications,
updateStats, updateStatusIndicator, updateThemeChecks, updateToolingMovementsTable
```

Globals window: `cambiarTab`, `changeTheme`, `toggleDarkMode`, `toggleCompactMode`, `toggleNotifications`, `sendWebhook`, `requestCreatorAccess`, `validatePin`, `toggleMobileMenu`, etc.

---

## 18. Checklist migración visual (pendiente)

Prioridad sugerida para paridad UX sin copiar HTML:

1. **Temas ×6** — ¿YAGNI si brand único en Next?
2. **Mapas 80MB** — servir desde CDN/Storage, no bundle
3. **ApexCharts** — analytics tab
4. **Browser notifications** — opt-in post-MVP
5. **Ctrl+1-9** — bajo valor con rutas URL
6. **Relevos** — comunicar migración localStorage → servidor
7. **PIN** — no reintroducir; documentar decisión seguridad
8. **Loader copy** — "Consultando satélites" vs spinners genéricos
9. **Hostinger** — coexistencia hasta cutover DNS/tráfico

---

## 19. Referencias cruzadas

- Rutas: `legacy-route-inventory.md`
- Red/webhooks: `legacy-network-inventory.md`
- UI/IDs: `legacy-ui-inventory.md`
- Storage: `legacy-storage-inventory.md`
- Backend migración: `n8n-to-supabase.md`
