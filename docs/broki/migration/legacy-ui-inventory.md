# Inventario UI — legacy BROKI

> Componentes visuales, IDs DOM, modales, estados y comportamiento. Sin copiar HTML a React.

## Fuentes

- `public_html/broki.html` (7530 líneas, **canónico**)
- `public_html/broki2.html` (subset UI)
- https://airlogixai.com/broki.html (estructura confirmada)
- `web/` — referencia de paridad

---

## 1. Shell de aplicación

### Layout

| Zona | IDs / clases | Comportamiento |
|------|--------------|----------------|
| Sidebar desktop | `aside` fijo, `.nav-item`, `#nav-*` | 12 tabs, estado activo `bg-brand-50` |
| Sidebar móvil | `#mobile-sidebar`, `#mobile-menu-overlay`, `.mobile-nav-item` | `toggleMobileMenu()`, slide `-translate-x-full` |
| Topbar | búsqueda, campana, tema, refresh, compact, dark | sticky `z-30` |
| Contenido | `#app-content`, `#main-scroll` | scroll principal |
| Loader global | `#loader` | "Consultando satélites..." |
| Error global | `#error-banner`, `#error-text` | botón Reintentar → `cargarDatos()` |

### Topbar — controles

| ID | Función |
|----|---------|
| `inputBusqueda` | Búsqueda global (highlight en cards) |
| `notifications-bell` | `toggleNotifications()` |
| `notifications-dropdown` | lista alertas |
| `notifications-badge` | contador |
| `notifications-list` / `notifications-empty` | estados lista |
| `theme-selector-btn` | `toggleThemeSelector()` |
| `theme-dropdown` | 6 opciones `changeTheme(...)` |
| `dark-mode-toggle` / `dark-mode-icon` | `toggleDarkMode()` |
| `btnRefrescar` / `refresh-icon` | refresh manual |
| `autoRefresh` | checkbox auto-refresh |
| `btnCompactMode` / `compact-icon` | `toggleCompactMode()` |
| `update-indicator` / `update-text` / `ping-indicator` / `static-indicator` | estado sync |
| `weather-widget` | widget METAR simplificado |
| `page-title` | título tab dinámico |

Next: `Topbar.tsx` + `Sidebar.tsx` — sin selector de 6 temas; sí PWA install + menú usuario auth.

---

## 2. Temas y dark mode

### Temas de color (`data-theme`)

| Nombre | Trigger onclick |
|--------|-----------------|
| `default` | `changeTheme('default')` |
| `sunset` | `changeTheme('sunset')` |
| `oceanic` | `changeTheme('oceanic')` |
| `forest` | `changeTheme('forest')` |
| `midnight` | `changeTheme('midnight')` |
| `monochrome` | `changeTheme('monochrome')` |

CSS: 6 bloques `[data-theme=...]` + variables `--theme-primary-*` (patrón similar a `web/src/app/globals.css` pero solo `default` en Next).

### Dark mode

- Toggle manual → `document.documentElement.classList.toggle('dark')`
- Persistencia: `broki_dark_mode`
- Conflicto potencial: bloque Tailwind CDN también escribe `localStorage.theme`

---

## 3. View containers (`*-view`)

| ID | Visible cuando tab |
|----|-------------------|
| `dashboard-view` | dashboard (KPI + grid) |
| `mapa-view` | mapa |
| `analytics-view` | analytics |
| `planner-view` | planner |
| `roster-view` | roster |
| `fleet-view` | fleet |
| `stock-view` | stock |
| `tooling-view` | tooling |

Tabs `furgonetas`, `gse`, `aviones`, `incidencias` reutilizan `#render-area` / `#fleet-grid` sin sufijo `-view` dedicado.

---

## 4. Modales (`<dialog>`)

| ID | Apertura | Contenido |
|----|----------|-----------|
| `detail-modal` | `openDetail(id, type)` | Ficha equipo: `#modal-title`, `#modal-subtitle`, `#modal-status-badge`, `#modal-type-badge`, `#modal-info-grid`, `#modal-incidents-area`, `#modal-history-area`, `#create-incident-form`, `#new-incident-text`, `#new-incident-worker` |
| `relay-modal` | `openRelayModal()` | `#relay-plane`, `#relay-worker`, `#relay-points-container`, `saveRelay()` |
| `pin-modal` | `requestCreatorAccess()` | `#pin-input` (4 dígitos), `validatePin()` |

Cierre: botones Cerrar/Cancelar, `Escape`, `closeModal()`.

**Next:** `EquipmentDetailModal.tsx` (paridad detail); relevos en página fleet; PIN **eliminado** en planner (auth Supabase).

---

## 5. Dashboard — KPI y widgets

| ID | Métrica |
|----|---------|
| `kpi-total` | Total equipos |
| `kpi-operative` / `kpi-operative-percent` | Operativos |
| `kpi-issues` / `kpi-issues-percent` | Incidencias |
| `kpi-inuse` / `kpi-inuse-percent` | En uso |
| `kpi-fuel` / `kpi-fuel-alert` | Combustible bajo |
| `kpi-health` | Salud flota % |
| `kpi-trend-total` | Tendencia |
| `kpi-widgets` | contenedor |
| `stat-total`, `stat-available`, `stat-inop`, `stat-active` | fila stats |

Acción rápida: `#btn-quick-action` → incidencias.

Filtros: `#lblEstado`, `#selectStatus`, `#selectAvion`, `#family-filters`, `#family-filters-container`, `filterFamily()`, `toggleFamily()`.

---

## 6. Gráficos (ApexCharts)

| ID canvas | Título UI |
|-----------|-----------|
| `chart-status` | Estado de la Flota |
| `chart-family` | Composición por Familia |
| `chart-fuel` | Alerta Combustible Crítico (<25%) |

Render: `renderAnalytics()` tras tab `analytics`.

---

## 7. Mapa

| Modo | Implementación |
|------|----------------|
| Leaflet | `#leaflet-map` — capa dinámica |
| Estático | `#map-content`, imágenes `assets/maps/t{4,s,123}_real.jpg` |
| Tabs mapa | `switchMap('t4'|'t4s'|'t123')` |

Coordenadas: objeto `MAPS` con zonas pre-mapeadas por terminal (comentarios "Portrait Layout").

Pins equipos: `getMapPosition()` según parking/ubicación.

**Next:** `mapa/page.tsx` — imagen estática + pins CSS, sin Leaflet.

---

## 8. Planner UI

| ID | Rol |
|----|-----|
| `btn-create-job` | Abre flujo → PIN |
| `planner-creator-panel` | Oculto hasta PIN OK |
| `planner-board-panel` | Pizarra trabajos |
| `planner-empty` | Empty state |
| `pdf-dropzone` / `file-upload` | Drag PDF hoja trabajo |
| `parsed-tasks-container` / `tasks-preview-list` | Tareas OCR/PDF |
| `plan-matricula`, `plan-modelo`, `plan-aerolinea` | Campos avión |
| `plan-salida`, `plan-llegada` | Horas (+ botón BASE) |
| `plan-responsable`, `plan-workers-list`, `worker-search` | Personal |
| `plan-furgo` | Vehículo |
| `assignments-list` | Grupos en pizarra |

Eventos: drag/drop PDF (`preventDefaults`, dragover/dragleave/drop en dropzone).

---

## 9. Roster UI

| ID | Modo |
|----|------|
| `btn-roster-weekly` / `btn-roster-daily` | `setRosterMode` |
| `roster-weekly-container` / `roster-daily-container` | vistas |
| `roster-table-body` | tabla semanal (7 columnas día) |
| `roster-daily-grid` | vista diaria |
| `roster-upload` | input file PDF oculto |
| `btn-ra-all`, `btn-ra-iberojet`, `btn-ra-w2f` | filtro aerolínea |

---

## 10. Fleet / Relevos

Sección en `fleet-view`: lista relevos + botón `openRelayModal()`.

Sin IDs de lista estables (render dinámico); modal `#relay-modal`.

---

## 11. Stock nitrógeno

| ID | Acción |
|----|--------|
| `stock-content` | tarjetas por terminal |
| `btn-stock-edit` | `toggleStockEdit()` |
| `input-${t.id}-full` / `input-${t.id}-empty` | botellas llenas/vacías (template dinámico) |

---

## 12. Tooling UI

| Sección | IDs |
|---------|-----|
| Check-out | `#checkout-section`, `#checkout-person`, `#checkout-aircraft`, `#checkout-bac`, dropdowns `*-dropdown`, `#checkout-notes` |
| Check-in | `#checkin-section`, simétrico |
| Tabla movimientos | `#tooling-movements-table` |
| Chevrones | `#checkout-chevron`, `#checkin-chevron` — `toggleToolingSection` |

Autocompletado: `initToolingAutocomplete()`, handlers `handleTooling*Input`.

---

## 13. Incidencias

- Tab dedicado + sección en `detail-modal`
- Form crear: `showCreateIncident()`, `submitNewIncident()`
- Historial: `toggleIncidentHistory('${h.id}')`, IDs `hist-${h.id}`, `icon-${h.id}`
- Cerrar incidencia: `#close-incident-check`

---

## 14. Inventario completo de IDs HTML (162)

### Estáticos (sin templates `${...}`)

```
aircraft-list, analytics-view, app-content, assignments-list, autoRefresh,
btn-create-job, btn-gse-edit, btn-quick-action, btn-ra-all, btn-ra-iberojet,
btn-ra-w2f, btn-roster-daily, btn-roster-weekly, btn-stock-edit, btnCompactMode,
btnRefrescar, chart-family, chart-fuel, chart-status, checkin-bac,
checkin-bac-dropdown, checkin-chevron, checkin-description, checkin-notes,
checkin-person, checkin-person-dropdown, checkin-section, checkout-aircraft,
checkout-aircraft-custom, checkout-bac, checkout-bac-dropdown, checkout-chevron,
checkout-description, checkout-info, checkout-notes, checkout-person,
checkout-person-dropdown, checkout-section, close-incident-check, compact-icon,
create-incident-form, dark-mode-icon, dark-mode-toggle, detail-modal, edit-notes,
error-banner, error-text, family-filters, family-filters-container, file-upload,
fleet-grid, fleet-view, info-aircraft, info-date, info-person, info-status,
inputBusqueda, kpi-fuel, kpi-fuel-alert, kpi-health, kpi-inuse, kpi-inuse-percent,
kpi-issues, kpi-issues-percent, kpi-operative, kpi-operative-percent, kpi-total,
kpi-trend-total, kpi-widgets, lblEstado, leaflet-map, loader, main-scroll,
map-container, map-content, mobile-menu-overlay, mobile-sidebar, modal-history-area,
modal-incidents-area, modal-info-grid, modal-status-badge, modal-subtitle,
modal-title, modal-type-badge, nav-analytics, nav-aviones, nav-dashboard, nav-fleet,
nav-furgonetas, nav-gse, nav-incidencias, nav-mapa, nav-planner, nav-roster,
nav-stock, nav-tooling, new-incident-text, new-incident-worker, new-msg-input,
notifications-badge, notifications-bell, notifications-dropdown, notifications-empty,
notifications-list, page-title, parsed-tasks-container, pdf-dropzone, pin-input,
pin-modal, ping-indicator, plan-aerolinea, plan-furgo, plan-llegada, plan-matricula,
plan-modelo, plan-responsable, plan-salida, plan-workers-list, planner-board-panel,
planner-creator-panel, planner-empty, planner-view, refresh-icon, relay-modal,
relay-plane, relay-points-container, relay-worker, render-area, roster-daily-container,
roster-daily-grid, roster-table-body, roster-upload, roster-view, roster-weekly-container,
selectAvion, selectStatus, stat-active, stat-available, stat-inop, stat-total,
static-indicator, stats-row, stock-content, stock-view, tasks-preview-list,
theme-dropdown, theme-icon, theme-selector-btn, tooling-movements-table, tooling-view,
update-indicator, update-text, weather-widget, worker-search
```

### Dinámicos (patrones template)

```
${noteId}-full / ${noteId}-short     — notas expandibles
edit-${key}                          — campos edición stock
hist-${h.id} / icon-${h.id}          — historial incidencias
input-${item.id}-p${idx}             — puntos relevo
input-${t.id}-empty / input-${t.id}-full — stock nitro
```

---

## 15. Event listeners (`addEventListener`)

| Elemento | Eventos |
|----------|---------|
| `#inputBusqueda` | `input` |
| `#selectStatus`, `#selectAvion`, `#autoRefresh` | `change` |
| `#btnRefrescar` | `click` |
| `#pin-input` | `keypress` (Enter → validatePin) |
| `document` | `keydown` (atajos), `DOMContentLoaded` |
| PDF dropzone | `dragover`, `dragleave`, `drop` |
| `window` | `load` |

**Mayoría de interacciones:** `onclick` inline (86 variantes únicas).

---

## 16. Estados UI

### Loading

| Contexto | Patrón |
|----------|--------|
| Boot | `#loader` visible, texto satélites |
| Fetch | `setLoading(true)`, icono refresh spin, `updateStatusIndicator('updating')` |
| Manual refresh | `cargarDatos(true)` |

### Error

| Contexto | Patrón |
|----------|--------|
| Red global | `#error-banner` + Reintentar |
| Tooling catálogo | `alert()` |
| PIN incorrecto | `animate-pulse border-red-500` en input |
| Form incidencias | inline en modal |

### Empty

| Contexto | Función / ID |
|----------|--------------|
| Planner | `#planner-empty` — "No hay trabajos asignados" |
| Notificaciones | `#notifications-empty` |
| Listas filtradas | `EmptyState` component (función render) |
| Roster sin datos | fila tabla vacía / mensaje |

### Hover / móvil

- **Hover:** tooltips `group-hover:opacity-100` en iconos topbar; cards `hover:shadow-md`; pins mapa tooltip `group-hover/pin:block`
- **Móvil:** sidebar overlay; botones roster aerolínea `md:flex` hidden en móvil; grid responsive `@media (max-width: 768px)` ajusta columnas KPI
- **Active:** `active:scale-95` en botones primarios

---

## 17. Assets UI

| Asset | Ruta legacy | Next |
|-------|-------------|------|
| Logo app | `assets/icon.jpg` | `/assets/icon.jpg` |
| Favicon | `images/favicon.png` | `/images/favicon.png` |
| Logo marketing | `images/logo_3.png` | `/images/logo_3.png` |
| Mapas T4/T4S/T123 | `assets/maps/*_real.jpg` (~80MB total) | **No copiados** a `web/public` |

---

## 18. Gaps UI Next vs legacy

| Elemento legacy | Estado Next |
|-----------------|-------------|
| 6 temas color | ❌ |
| Leaflet mapa | ❌ (estático) |
| ApexCharts analytics | ⚠️ verificar paridad charts |
| PIN modal planner | ❌ (reemplazado por auth) |
| Browser Notification API | ❌ |
| `Ctrl+?` ayuda atajos | ❌ |
| `Ctrl+1-9` tabs | ❌ |
| Loader "Consultando satélites" | ⚠️ spinners por página |
| Quick action KPI → incidencias | ⚠️ revisar dashboard Next |
