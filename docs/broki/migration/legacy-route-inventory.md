# Inventario de rutas — legacy BROKI

> Generado como baseline de migración visual. **No implementa cambios.** Hostinger / `public_html/` permanece intacto.

## Fuentes consultadas

| Fuente | Estado | Notas |
|--------|--------|-------|
| https://airlogixai.com/broki.html | ✅ Live (fetch) | Producción actual en Hostinger |
| `public_html/broki.html` | ✅ Local | **7530 líneas**, versión completa (canónica) |
| `public_html/broki2.html` | ✅ Local | **4243 líneas**, subconjunto de features |
| `web/` (Next.js) | ✅ Repo | Rutas App Router |
| `public_html/manifest.json` | ✅ Local | PWA legacy |
| `web/public/manifest.json` | ✅ Repo | PWA Next |
| `_airlogixai.com.zip` | ❌ No presente | Referenciado en `export-repo-zip.sh` (excluido del zip) |
| `broki_en_multiarchivos/**` | ❌ No presente | Sin copia en workspace |
| `PRODUCCION_REGISTROS_DASHBOARD.json` | ❌ No presente | Citado en `20260617213000_broki_core_schema.sql` |
| `PRODUCCION_FLUJO_PRINCIPAL.json` | ❌ No presente | Citado en migración core schema |
| `Desarrollo.json` | ❌ No presente | — |

**Canónico para inventario de dashboard:** `public_html/broki.html` (producción live coincide en estructura de tabs).

---

## 1. Sitio público (marketing + legal)

### Legacy (`public_html/` → Hostinger)

| Ruta archivo | Propósito |
|--------------|-----------|
| `/index.html` | Landing AirLogix |
| `/broki.html` | **Dashboard SPA** (app principal) |
| `/broki2.html` | Dashboard reducido (dev/staging histórico) |
| `/registrobroki.html` | Registro de personal |
| `/contacto.html` | Contacto |
| `/gracias.html` | Post-envío |
| `/integraciones.html` | Integraciones |
| `/aviso-legal.html` | Aviso legal |
| `/politica-cookies.html` | Cookies |
| `/politica-privacidad.html` | Privacidad |
| `/sobre-nosotros.html` | Sobre nosotros |
| `/solicita-demo.html` | Demo |
| `/soluciones.html` | Soluciones |
| `/pres.html` | Presentación |
| `/fallos.html` | Página de fallos |
| `/fix_tooling.html` | Utilidad tooling (fix) |
| `/juego_bebida/` | Mini-juego (fuera de scope BROKI) |

### Next.js (`web/src/app/`)

| Ruta URL | Archivo | Equivalente legacy |
|----------|---------|-------------------|
| `/` | `(public)/page.tsx` | `index.html` |
| `/contacto` | `(public)/contacto/page.tsx` | `contacto.html` |
| `/gracias` | `(public)/gracias/page.tsx` | `gracias.html` |
| `/integraciones` | `(public)/integraciones/page.tsx` | `integraciones.html` |
| `/aviso-legal` | `(public)/aviso-legal/page.tsx` | `aviso-legal.html` |
| `/politica-cookies` | `(public)/politica-cookies/page.tsx` | `politica-cookies.html` |
| `/politica-privacidad` | `(public)/politica-privacidad/page.tsx` | `politica-privacidad.html` |
| `/sobre-nosotros` | `(public)/sobre-nosotros/page.tsx` | `sobre-nosotros.html` |
| `/solicita-demo` | `(public)/solicita-demo/page.tsx` | `solicita-demo.html` |
| `/soluciones` | `(public)/soluciones/page.tsx` | `soluciones.html` |
| `/pres` | `(public)/pres/page.tsx` | `pres.html` |
| `/registrobroki` | `(public)/registrobroki/page.tsx` | `registrobroki.html` |
| `/login` | `login/page.tsx` | **Nuevo** — auth Supabase (no existía en legacy SPA) |
| `/broki` | `broki/(dashboard)/page.tsx` | Tab `dashboard` |
| `/broki/*` | `broki/(dashboard)/*/page.tsx` | Tabs internos |

### Redirects Next (`web/next.config.ts`)

Rutas cortas legacy → dashboard:

| Source | Destination |
|--------|-------------|
| `/mapa` | `/broki/mapa` |
| `/furgonetas` | `/broki/furgonetas` |
| `/gse` | `/broki/gse` |
| `/aviones` | `/broki/aviones` |
| `/incidencias` | `/broki/incidencias` |
| `/analytics` | `/broki/analytics` |
| `/planner` | `/broki/planner` |
| `/roster` | `/broki/roster` |
| `/fleet` | `/broki/fleet` |
| `/stock` | `/broki/stock` |
| `/tooling` | `/broki/tooling` |

Legacy **no** tenía URLs por tab: todo es `broki.html` + `cambiarTab()`.

---

## 2. Dashboard SPA — tabs / secciones

Navegación vía `window.cambiarTab(tab)` + botones `#nav-{tab}` y `.mobile-nav-item`.

| Tab ID legacy | Título UI (`page-title`) | Nav ID | View container ID | Ruta Next |
|---------------|--------------------------|--------|-------------------|-----------|
| `dashboard` | Vista General | `nav-dashboard` | `dashboard-view` (implícito en `#app-content`) | `/broki` |
| `mapa` | Mapa en Vivo | `nav-mapa` | `mapa-view` | `/broki/mapa` |
| `furgonetas` | Furgonetas | `nav-furgonetas` | — (render en `#render-area`) | `/broki/furgonetas` |
| `gse` | Equipos GSE | `nav-gse` | — | `/broki/gse` |
| `aviones` | Por Avión | `nav-aviones` | — | `/broki/aviones` |
| `incidencias` | Incidencias | `nav-incidencias` | — | `/broki/incidencias` |
| `analytics` | Analítica | `nav-analytics` | `analytics-view` | `/broki/analytics` |
| `planner` | Planificador | `nav-planner` | `planner-view` | `/broki/planner` |
| `roster` | Horario | `nav-roster` | `roster-view` | `/broki/roster` |
| `fleet` | Flota | `nav-fleet` | `fleet-view` | `/broki/fleet` |
| `stock` | Stock Nitro | `nav-stock` | `stock-view` | `/broki/stock` |
| `tooling` | Tooling | `nav-tooling` | `tooling-view` | `/broki/tooling` |

**Total tabs producción:** 12.

### `broki2.html` — tabs presentes

Solo 9 tabs: `dashboard`, `mapa`, `furgonetas`, `gse`, `aviones`, `incidencias`, `analytics`, `planner`, `roster`.

**Ausentes en broki2:** `fleet`, `stock`, `tooling` (sin views, sin nav, sin endpoints extra en `ENDPOINTS`).

---

## 3. Sub-secciones dentro de tabs

| Tab | Sub-sección | IDs / controles |
|-----|-------------|-----------------|
| Dashboard | KPI widgets | `#kpi-*`, `#stats-row` |
| Dashboard | Grid equipos | `#fleet-grid`, `#render-area` |
| Dashboard | Filtros | `#inputBusqueda`, `#selectStatus`, `#selectAvion`, `#family-filters` |
| Dashboard | Clima | `#weather-widget` |
| Mapa | Leaflet + estático | `#leaflet-map`, `#map-container`, `switchMap('t4'\|'t4s'\|'t123')` |
| Planner | Creador (PIN) | `#planner-creator-panel`, `#btn-create-job` |
| Planner | Pizarra | `#planner-board-panel`, `#assignments-list` |
| Roster | Semanal / diario | `#btn-roster-weekly`, `#btn-roster-daily`, `#roster-table-body`, `#roster-daily-grid` |
| Roster | Filtro aerolínea | `#btn-ra-all`, `#btn-ra-iberojet`, `#btn-ra-w2f` |
| Fleet | Relevos | `#relay-modal`, lista en fleet view |
| Stock | Edición | `#btn-stock-edit`, `#stock-content` |
| Tooling | Check-in / out | `#checkin-section`, `#checkout-section` |
| Incidencias | Vista dedicada | filtros + lista (comparte datos con modal) |

---

## 4. PWA — `start_url`

| Manifest | `start_url` | Implicación |
|----------|-------------|-------------|
| Legacy `public_html/manifest.json` | `./broki.html` | Instala contra Hostinger |
| Next `web/public/manifest.json` | `/broki` | Instala contra Vercel |

---

## 5. Atajos de teclado → navegación

Legacy (`broki.html`):

| Atajo | Acción |
|-------|--------|
| `Ctrl+1` | `dashboard` |
| `Ctrl+2` | `furgonetas` |
| `Ctrl+3` | `gse` |
| `Ctrl+4` | `planner` |
| `Ctrl+5` | `mapa` |
| `Ctrl+6` | `incidencias` |
| `Ctrl+7` | `analytics` |
| `Ctrl+8` | `stock` |
| `Ctrl+9` | `roster` |
| `Ctrl+?` | Alert con lista de atajos |

**Next:** no hay `Ctrl+1-9` ni `Ctrl+?`. Sí hay `Ctrl+K`, `/`, `Ctrl+R`, `Escape` en `broki/(dashboard)/layout.tsx`.

---

## 6. Matriz de cobertura rutas Next vs legacy

| Feature / tab | Legacy broki.html | Next `/broki/*` |
|---------------|-------------------|-----------------|
| Dashboard | ✅ | ✅ `/broki` |
| Mapa | ✅ | ✅ `/broki/mapa` |
| Furgonetas | ✅ | ✅ |
| GSE | ✅ | ✅ |
| Por avión | ✅ | ✅ |
| Incidencias | ✅ | ✅ |
| Analítica | ✅ | ✅ |
| Planner | ✅ (+ PIN) | ✅ (sin PIN; sesión Supabase) |
| Roster | ✅ | ✅ |
| Flota / relevos | ✅ | ✅ `/broki/fleet` |
| Stock N₂ | ✅ | ✅ `/broki/stock` |
| Tooling | ✅ | ✅ `/broki/tooling` |
| Registro personal | `registrobroki.html` | ✅ `/registrobroki` |
| Login | ❌ | ✅ `/login` |

---

## 7. Notas de arqueología

1. **SPA monolítica:** una sola URL (`broki.html`); el estado de tab no va en query string ni hash.
2. **`cambiarTab` duplicado:** hay dos implementaciones en `broki.html` (~L1902 y ~L3942); la segunda parece refactor parcial del sidebar desktop.
3. **Vista siempre arranca en dashboard:** `restoreFilters()` no restaura `view` (comentario explícito en código).
4. **Producción live** sirve la misma estructura de tabs que `public_html/broki.html` (verificado por fetch remoto).
