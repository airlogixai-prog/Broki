# Inventario de almacenamiento cliente — legacy BROKI

> `localStorage`, estado en memoria y persistencia. Sin implementar migración.

## Fuentes

- `public_html/broki.html` (canónico)
- `web/src/context/AppContext.tsx`
- `web/src/app/layout.tsx` (hydration dark mode)

---

## 1. Claves `localStorage` (legacy)

| Clave | Tipo | Escritura | Lectura | Contenido |
|-------|------|-----------|---------|-----------|
| `broki_filters` | JSON | `saveFilters()` al cambiar filtros | `restoreFilters()` al boot | `{ search, status, avion, family, view }` — **view no se restaura** |
| `broki_compact_mode` | `"true"` / `"false"` | `toggleCompactMode()` | `state.compactMode` init | Vista compacta grid equipos |
| `broki_theme` | string | `changeTheme()` | boot | `default` \| `sunset` \| `oceanic` \| `forest` \| `midnight` \| `monochrome` |
| `broki_dark_mode` | `"true"` / `"false"` | `toggleDarkMode()` | boot | Clase `dark` en `<html>` |
| `relays_db` | JSON array | `saveRelay()` / `deleteRelay()` | `state.relays` init | Relevos de turno (avión, técnico, puntos) |
| `localStorage.theme` | `"light"` / `"dark"` | bloque Tailwind CDN (~L4028) | media query fallback | **Duplicado parcial** con `broki_dark_mode` |

### No usado en legacy

- `sessionStorage` — sin referencias en `broki.html`
- `IndexedDB` — no
- Cookies de app — no (solo posibles cookies analytics del sitio marketing)

---

## 2. Semántica por clave

### `broki_filters`

```json
{
  "search": "string — texto búsqueda",
  "status": "all | available | occupied | inoperative | ...",
  "avion": "all | matrícula",
  "family": "all | familia GSE",
  "view": "tab actual — guardado pero NO restaurado al reload"
}
```

Elementos UI sincronizados: `#inputBusqueda` (también id `input-search` en restore), `#selectStatus`, `#selectAvion`, `#filter-family`.

### `broki_compact_mode`

- `true` → `#render-area` clase `compact-view`, icono `#compact-icon` `ph-squares-four`
- Afecta cards en dashboard / listas equipos

### `broki_theme` + `data-theme`

Atributo `data-theme` en `<html>` para paletas CSS (6 variantes con reglas `[data-theme=...]`).

`default` → elimina atributo.

### `relays_db`

Estructura en memoria (~array):

```json
[
  {
    "plane": "EC-XXX",
    "worker": "Nombre",
    "points": ["Punto 1", "Punto 2"],
    "timestamp": "ISO o similar"
  }
]
```

**Crítico:** única persistencia de relevos en legacy. **No hay webhook** en create/delete.

Next migró a Edge Function `relays` (Postgres) — divergencia de datos si coexisten sistemas.

---

## 3. Estado en memoria (`const state`)

No persiste salvo campos hidratados desde `localStorage`:

| Campo | Persiste | Origen red |
|-------|----------|------------|
| `furgonetas[]` | No | `INVENTORY` |
| `gse[]` | No | `INVENTORY` |
| `personal[]` | No | `PERSONAL` |
| `incidents[]` | No | `GET_INCIDENTS` |
| `assignments[]` | No | planner groups+tasks |
| `nitroStock` | No | `GET_NITRO_STOCK` |
| `relays[]` | Sí (`relays_db`) | local |
| `view` | No (reset dashboard) | — |
| `filter`, `*Filter` | Sí (`broki_filters`) | — |
| `loading` | No | — |
| `lastUpdate` | No | — |
| `compactMode` | Sí | — |

### Variables globales adicionales (tooling)

`toolCatalog`, `personnelList`, `aircraftList`, `toolMovements` — solo memoria, recargan en tab tooling.

### Clima

`weatherData` — memoria; se refresca en alertas si null.

---

## 4. `autoRefresh` y controles UI

| Control | ID legacy | Comportamiento |
|---------|-----------|----------------|
| Auto-refresh | `#autoRefresh` checkbox | `startAutoRefresh()` / `stopAutoRefresh()` |
| Refresh manual | `#btnRefrescar` | `cargarDatos(true)` |

Intervalo: **30 segundos** (`setInterval(fetchData, 30000)`).

### Next (`AppContext`)

| Clave | Default | Notas |
|-------|---------|-------|
| `broki_auto_refresh` | `true` (ausencia = on) | Toggle en Topbar |
| `broki_compact_mode` | `false` | Paridad legacy |
| `broki_dark_mode` | `false` | Paridad + script en `layout.tsx` anti-flash |
| `broki_filters` | mismo shape | Sin campo `view` |

**No migrado a Next:**

- `broki_theme` / `data-theme` (6 temas)
- `relays_db` (reemplazado por API `relays`)
- `localStorage.theme` (Tailwind CDN)

---

## 5. Permisos browser

| API | Uso legacy |
|-----|------------|
| `Notification` | `requestNotificationPermission()`, `sendBrowserNotification()` — alertas combustible, clima, incidencias |
| Rate limit interno | `lastNotificationTime[type]` — mínimo 60s entre notificaciones del mismo tipo |

Next: campana in-app (`NotificationsBell`); **sin** Web Notifications API en código actual.

---

## 6. PWA / Cache

- Legacy manifest: `start_url: ./broki.html` — sin service worker visible en HTML.
- Next: `PwaInstallButton` — instalación; cache según Vercel/Next defaults.

---

## 7. Matriz persistencia legacy → Next

| Dato | Legacy | Next |
|------|--------|------|
| Filtros búsqueda/estado | `broki_filters` | `broki_filters` ✅ |
| Compact mode | `broki_compact_mode` | ✅ |
| Dark mode | `broki_dark_mode` | ✅ |
| Auto-refresh pref | checkbox DOM | `broki_auto_refresh` ✅ |
| Color theme (6) | `broki_theme` | ❌ solo brand orange CSS |
| Relevos | `relays_db` local | API `relays` ✅ (servidor) |
| Planner assignments | memoria + n8n | API planner ✅ |
| Incidencias | memoria + n8n | API + `incidentsMemory` en context |
| Tooling movimientos | memoria + webhook | API tooling ✅ |

---

## 8. Implicaciones migración

1. Usuarios con `relays_db` en Hostinger **no** verán esos datos en Next hasta export manual.
2. Temas `sunset`/`oceanic`/etc. se perderán visualmente al cutover si no se reimplementan.
3. Filtros son compatibles entre sistemas si las claves se mantienen (ya lo hace Next).
4. Dos fuentes de dark mode en legacy (`broki_dark_mode` vs `localStorage.theme`) — posible estado inconsistente en usuarios antiguos.
