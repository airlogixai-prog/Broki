# 03 — Sistema de diseño BROKI (Fase B)

**Estado:** implementado en código (2026-10-14). Fuente única: `web/src/styles/tokens.css`, `themes.css`, `components.css` y el mapeo `@theme inline` en `web/src/app/globals.css`. Componentes en `web/src/components/ui/`.

## Principios

1. **Operativo antes que decorativo**: la información crítica (estado, ubicación, operario, avión, combustible/N₂) va primero; sin tarjetas gigantes ni gradientes.
2. **Nunca solo color**: cada estado lleva icono y texto (`StatusBadge`, `Badge`, pins del mapa con letra D/U/I/?).
3. **Tokens, no `slate-*`**: ningún componente del dashboard usa clases `slate-*`/`dark:` ad hoc; todo pasa por alias semánticos.
4. **Un patrón por problema**: un `Modal`, un `ConfirmDialog`, un `PageHeader`, un `KpiCard`, un `ErrorState`, un `EmptyState`, un `Toast`.
5. **Móvil real**: controles ≥ 36 px (`min-h-9`), 40–44 px en acciones principales; texto mínimo 11 px; modales a pantalla completa en < 640 px con cabecera/pie fijos y cuerpo con scroll.

## Tokens semánticos (claro / oscuro en `tokens.css`)

| Alias Tailwind | Variable | Uso |
|---|---|---|
| `bg-canvas` | `--broki-bg` | fondo de la app |
| `bg-surface` / `bg-elevated` | `--broki-bg-elevated` | tarjetas, modales, tablas |
| `bg-muted` | `--broki-bg-muted` | campos de lectura, pies de modal |
| `bg-subtle` | `--broki-bg-subtle` | hover, tabs, chips neutros |
| `border-border` / `-subtle` / `-strong` | `--broki-border*` | bordes |
| `text-fg` / `-muted` / `-subtle` / `-inverse` | `--broki-text*` | jerarquía tipográfica |
| `brand-50…900` | `--theme-primary-*` | marca; sigue `data-theme` (6 temas legacy: default/sunset/oceanic/forest/midnight/monochrome) |
| `success`, `warning`, `danger`, `info`, `neutral` (+ `-strong`, `-muted`) | `--broki-*` | estados y alertas |
| `--broki-selection`, `:focus-visible` outline | `--broki-ring` | selección y foco visibles |

Reduced motion: `prefers-reduced-motion` anula transiciones y animaciones.

## Tipografía

- Inter (`--font-inter`) con fallback system; monospace para códigos (BAC, códigos de incidencia, P/N).
- Escala: `text-xl/2xl` título de página, `text-base/lg` títulos de sección, `text-sm` cuerpo, `text-xs` metadatos, `text-[11px]` solo etiquetas en mayúsculas.
- Números operativos con `.tabular` (`font-variant-numeric: tabular-nums`) en KPIs, PSI, horas y tablas.

## Estados operativos (`getStatusCategory` → `StatusBadge`)

| Categoría | Tono | Icono | Texto |
|---|---|---|---|
| available | success | CheckCircle | estado bruto (“Disponible”) |
| occupied | warning | Clock | “En Uso”, “Reservado”… |
| inoperative | danger | Prohibit / Wrench (mantenimiento) | “Inoperativo”, “Mantenimiento” |
| unknown | neutral | Question | “Sin estado” |

Incidencia abierta: `IncidentBadge` (danger) + borde rojo de tarjeta. Datos desconocidos (fuel/N₂ `null`) se muestran como “Sin lectura” / “—”, nunca como 0 ni como disponible.

## Componentes compartidos (`components/ui/`)

| Componente | Responsabilidad | Usado en |
|---|---|---|
| `PageHeader` | título, subtítulo operativo, icono, acciones, fila de filtros | las 12 rutas |
| `KpiCard` | cifra + sub + icono; clicable para filtrar/navegar | dashboard, incidencias, analítica, stock, tooling |
| `StatusBadge` / `Badge` / `IncidentBadge` | estado con icono + texto | tarjetas, modales, mapa, tooling |
| `Modal` | focus trap, Escape, restauración de foco, scroll lock, portal, móvil full-screen | equipo, planner, relevos, tooling, aviones |
| `ConfirmDialog` | sustituye `confirm()`; muestra el error si la acción falla | planner, relevos, aviones |
| `FormField` (`TextField`, `SelectField`, `TextareaField`, `FilterSelect`) | label + error por campo (`aria-invalid`, `aria-describedby`) | todos los formularios |
| `ErrorState` / `InlineError` | error visible con reintento | carga de cada módulo, escrituras |
| `EmptyState` | vacío con acción | listas y tabs |
| `Toast` (`useToast`) | confirmación tras respuesta del servidor (nunca antes) | todas las mutaciones |
| `DateSelector` | día/semana anterior-siguiente + input date + “Hoy” | planner, horario |
| `OperationalSyncBar` | estado Realtime/polling por dominio | planner, horario, relevos, stock, tooling |
| `Button` / `IconButton` | variantes primary/secondary/danger/success/ghost; `IconButton` exige `label` | todo |
| `BlockSkeleton` | carga | todo |

Patrones de dominio: `EquipmentCard`, `EquipmentGrid` (paginado 48), `FilterBar` (chips de filtros activos + saneado de filtros persistidos), `EquipmentDetailModal`, `IncidentSection`, `WorkGroupCard`, `PlannerCreator`, `NitroStockCard`, `EquipmentMapLeaflet`, `AircraftRegistry`.

## Reglas de interacción

- Ninguna mutación muestra éxito antes de la respuesta del servidor: optimista + rollback + `Toast` tras OK.
- Errores del servidor se traducen por código (`ApiError` en `lib/api/broki.ts`): `stale_update`, `open_checkout_exists`, `forbidden`, `incident_already_open`…
- Doble clic: botones con `loading` se deshabilitan; incidencias y tooling tienen además bloqueo en servidor.
- Edición concurrente de equipos: `expected_updated_at` → 409 `stale_update` → el modal ofrece “Cargar versión actual”.
- Mientras se edita (stock), los refrescos Realtime no pisan el borrador.

## Responsive

- Shell: sidebar fija ≥ 768 px; overlay en móvil; topbar con buscador a ancho completo en < 640 px.
- Grids: 1 → 2 → 3 → 4 columnas (compacto hasta 5); tablas con `min-w` y scroll horizontal aislado en su contenedor, nunca en la página.
- Modales: `max-h-[100dvh]` en móvil y `90vh` en escritorio.

## Mapa

Imágenes legacy (7016×9935, 8–43 MB) convertidas a WebP 2400×3399 (0,8–1,2 MB) y variante `-sm` (~120–165 KB) para < 768 px, en `web/public/maps/`. Posiciones = zonas operativas por rango de parking (tabla legacy), **no GPS**.
