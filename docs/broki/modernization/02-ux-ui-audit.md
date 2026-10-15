# 02 — Auditoría UX/UI

## Pasada 1 (Fase A, capturas locales 2026-10-11)

Entorno: Next dev + Supabase local con `seed.sql` (5 equipos, 3 aviones, 4 personas). Capturas 1440×900 y 390×844, claro; dark en segunda pasada. 0 errores de consola en las 12 rutas.

| # | Hallazgo | Impacto | Acción | Estado 2026-10-14 |
|---|---|---|---|---|
| U-01 | Estilos mezclados: tokens en shell, `slate-*` ad hoc en el resto | Dark incompleto | Tokens semánticos + `components/ui/` | ✅ 0 clases `slate-*` en `components/` y páginas del dashboard (login y públicas fuera de alcance) |
| U-02 | Dashboard apilaba 4 bandas antes de los KPIs | Jerarquía invertida | KPIs primero; meteo + sincronización en una fila; acciones rápidas en el `PageHeader` | ✅ captura `light_1440x900_broki` |
| U-03 | Buscador móvil inutilizable (“Bu…”) | Búsqueda imposible en móvil | Fila propia bajo el topbar en < 640 px; iconos secundarios ocultos en móvil | ✅ captura `*_390x844_*` |
| U-04 | Scroll horizontal en planner y roster (móvil) | Desplazamiento accidental | `min-width:0` en `.broki-shell__main`; tablas con scroll interno; topbar compactado | ✅ 0/130 capturas con `scrollWidth > clientWidth` tras la corrección (sonda a 360/390/768) |
| U-05 | Sin `PageHeader` común; títulos incoherentes con la navegación | Identidad confusa | `PageHeader` en 12 rutas; títulos = sidebar (Mapa, Aviones, Relevos, Tooling, Analítica…) | ✅ |
| U-06 | Tres barras de estado | Ruido | Topbar: estado + última actualización en todos los anchos; `OperationalSyncBar` solo en dominios con canal propio; `SystemStatusBar` solo en dashboard (con toggle de auto-refresco) | ✅ |
| U-07 | Emojis como iconos | No profesional, lectores de pantalla | Phosphor + `<dl>` semántico en tooling | ✅ |
| U-08 | `confirm()`/`alert()` | No accesible | `ConfirmDialog` | ✅ |
| U-09 | `<dialog open>` sin focus trap | A11y | `Modal` único (trap, Esc, restauración, scroll lock) | ✅ |
| U-10 | Botones icono sin nombre, selects sin label | WCAG 4.1.2 | `IconButton label` obligatorio, `FilterSelect label` | ✅ |
| U-11 | Mapa vacío | Módulo inutilizable | planos WebP en Leaflet | ✅ |
| U-12 | Textos 9–10 px | Legibilidad | mínimo 11 px (`text-[11px]`) en todo el dashboard | ✅ `grep text-\[9px\]|text-\[10px\]` → 0 en dashboard |
| U-13 | Estado solo por color | WCAG 1.4.1 | `StatusBadge` icono + texto; pins con letra; botellas con etiqueta ok/baja/crítica/vacía; combustible con (ok/medio/bajo) | ✅ |
| U-14 | Números no tabulares | Saltos | `.tabular` en KPI, PSI, horas, tablas | ✅ |
| U-15 | Indicador Next dev tapa el pill | dev only | — | n/a |
| U-16 | “Equipos asociados” vacío por filtros persistidos | UX confusa | saneado + chips | ✅ |

## Pasada 2 (Fase E, 2026-10-14)

Capturas: 13 rutas × {360, 390, 768, 1024, 1440} × {claro, oscuro} = 130 (`web/scripts/qa-screenshots.mjs`) + 11 estados interactivos × {1440, 390} × {claro, oscuro} = 46 (`web/scripts/qa-interactions.mjs`). Revisadas críticamente a mano: dashboard (360/390/768/1440, claro y oscuro), planner, mapa, tooling, incidencias, stock, aviones, horario, modal de equipo (lectura/edición, desktop/móvil), creador planner, sacada tooling.

| # | Hallazgo | Corrección | Verificación |
|---|---|---|---|
| V-01 | Etiquetas KPI truncadas (“TOTAL EQ…”, “COMBUSTI…”) a 360–768 px | `line-clamp-2` + `leading-tight` | captura 1440 y sonda móvil |
| V-02 | Buscador móvil incrustado en la fila de iconos (faltaban reglas `.broki-topbar__row`) | CSS de filas + media query para la fila móvil (regla sin capa, no podía usar `sm:hidden`) | acceptance 6 (un solo searchbox visible) |
| V-03 | Marca del sidebar en una línea (“BROKI Operaciones LEMD”) | `.broki-sidebar__title/subtitle` en bloque | captura |
| V-04 | IDs de tarjeta truncados en rejillas de 2 columnas (768 px) por el chip de familia | chip oculto bajo 17 rem de ancho de tarjeta (`@container`) | captura 768 |
| V-05 | Mapa abría en T4 sin pins aunque los equipos estuvieran en T4S | terminal inicial = la que más equipos posiciona | captura `*_broki_mapa` (T4S, 2 pins con letra U) |
| V-06 | Overflow horizontal 10 px en móvil (topbar) y en tablas a 768/1024 | `min-width:0` en `.broki-shell__main`; texto del pill de sync y botón PWA ocultos en < 640 px | sonda: 0 overflow |
| V-07 | Aviso “1 Issue” de Next en modo oscuro = desajuste de hidratación (iconos Sol/Luna, compacto, auto-refresco, chips de filtros persistidos, botón limpiar búsqueda) | `useHydrated()` (`useSyncExternalStore`) gobierna la UI dependiente de localStorage en el primer render | sonda con todas las preferencias: consola limpia, sin badge |
| V-08 | Asterisco de obligatorio en línea aparte en etiquetas con icono | label `flex flex-wrap` | captura creador planner (pendiente recaptura) |
| V-09 | Fecha del selector en formato en-US en las capturas | locale del Chromium headless; en navegadores es-ES muestra dd/mm/aaaa | n/a |

### Pendientes de pulido (no bloqueantes)
- Login y páginas públicas siguen con clases `slate-*` (fuera del alcance del dashboard).
- `KpiCard` con `href` usa `<a>` sin `next/link` (prefetch); solo decorativo.
- Secciones del dashboard no colapsables (G-41).

## Responsive (resumen tras pasada 2)
- 360/390: sin scroll horizontal; sidebar overlay; buscador en fila propia; KPIs en 2 columnas; tarjetas en 1 columna; modales a pantalla completa con cabecera y pie fijos; tablas (incidencias, historial tooling, horario) con scroll interno.
- 768: KPIs 3 columnas, tarjetas 2 columnas (chip de familia oculto), tablas con scroll interno.
- 1024/1440: 6 KPIs en fila, tarjetas 3–4 columnas, mapa 60 vh.
- Oscuro: todas las superficies, bordes, badges, gráficos (donut con variables CSS) y mapa revisados en capturas `dark_*`.

## Pasada 3 (tick 3, 2026-10-14 noche)

Recaptura completa (130 rutas × anchos × temas: **0 overflow, 0 errores de consola**) + 46 interacciones tras la revisión independiente.

| # | Hallazgo | Corrección |
|---|---|---|
| V-10 | KPI a 768 px (3 columnas): etiquetas largas recortadas (“OPERATIV”) | `KpiCard` es `@container`; el icono se oculta bajo 11 rem y la etiqueta recupera el ancho |
| V-11 | Tarjeta con incidencia en rejilla de 2 columnas: id partido (“E-\n07”) por el badge | cabecera `flex-wrap`; bajo 17 rem el badge “Incidencia” pasa a su propia línea; id `whitespace-nowrap` |
| V-12 | `EquipmentCard` era un `<button>` con `<h3>` y listas dentro (HTML inválido, sin navegación por encabezados) | `article` con botón “stretched” en el `h3`: toda la tarjeta sigue siendo clicable, el objetivo accesible es el id |
| V-13 | Tabs sin teclado | flechas/Home/End + tabindex itinerante en los 4 tablists |
