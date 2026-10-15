# 05 — Plan de implementación por dominios

Orden decidido tras la auditoría (dependencias → gravedad). Cada bloque termina con lint + tsc + unit + integration verdes y evidencia en `06-qa-evidence.md`.

**Estado 2026-10-14:** bloques 0–10 ejecutados en local (rama `feat/broki-modernization`, árbol sin commit). Pendiente: Fase F remota (bloqueada por red) y los puntos marcados ⏳.

## Bloque 0 — Seguridad local y base de verificación ✅
1. `20260810200000_broki_user_access_rls.sql` corregida (`%L`→`%I`) y aplicada en local.
2. Entorno desechable: `supabase db reset` + usuario QA + `broki_user_access` + `functions serve` + Next dev `:3100` con `allowedDevOrigins`.

## Bloque 1 — Foundation visual (Fase B) ✅
- Tokens semánticos y alias `@theme` (`03-design-system.md`).
- `components/ui/`: PageHeader, KpiCard, StatusBadge/Badge, Modal, ConfirmDialog, FormField (Text/Select/Textarea/FilterSelect), Button/IconButton, ErrorState/InlineError, EmptyState, Toast, DateSelector, OperationalSyncBar, BlockSkeleton.
- Todas las páginas del dashboard y sus componentes de dominio migrados a tokens (sin `slate-*`); topbar con buscador móvil en fila propia; sidebar con marca en dos líneas.

## Bloque 2 — Dashboard y equipos ✅
- `lib/equipment/kpis.ts` único; KPIs clicables; `filterEquipment` con `issues` = inoperativo ∪ incidencia abierta.
- Modal de equipo: estado canónico, ubicación habitual + parking, datalists, errores por campo, `expected_updated_at` → 409.
- Alertas completas (inoperativos, N₂) + notificaciones de navegador opt-in; meteo compartida.

## Bloque 3 — Aviones y mapa ✅
- Mapa con planos WebP en Leaflet, leyenda por estado, listas posicionados/sin posición, terminal automática.
- Aviones: vista por avión, filtros saneados, registro con Modal/ConfirmDialog/errores de duplicado.

## Bloque 4 — Incidencias ✅
- EF: una incidencia abierta por equipo (409) + reintento de código en colisión.
- Página: KPIs, tarjetas, registro global con búsqueda y filtro.

## Bloque 5 — Planner ✅ (G-15 descubierto y corregido)
- Dedupe por id/`group_id`, llegada/En base/Pre-vuelo, selector de día, creator modal con preview `dry_run`, diálogos accesibles.
- **Hallazgo:** la creación fallaba siempre por casts `timestamptz` (hora suelta, "BASE"); corregido en cliente + `destino`.

## Bloque 6 — Roster ✅ · Bloque 7 — Relevos ✅ · Bloque 8 — Stock ✅ · Bloque 9 — Tooling ✅ (migración `20261014120000`)

## Bloque 10 — Registro, alertas/preferencias, atajos ✅
- Registro verificado E2E (alta + duplicado + teléfono inválido). Atajos Ctrl+1..9 y Ctrl+?.

## Fase D — Integridad 🟡
- Contratos EF ↔ DTO ↔ mapper: `pipeline-p0.test.ts`, `tooling.test.ts`, `nitro.test.ts`, `mappers.test.ts`.
- Realtime: un canal por dominio; refresco diferido mientras se edita stock. ⏳ reconciliación explícita al volver a la pestaña (`visibilitychange`) no añadida: el polling de 30 s y Realtime cubren el caso; se deja como mejora.
- ✅ E2E de concurrencia a dos sesiones (409 `stale_update`) y Realtime entre dos sesiones (`e2e/flows.spec.ts`, tick 2).

## Fase E — QA independiente 🟡
- Suite Playwright 57 tests en local; capturas 13 rutas × 5 anchos × 2 temas + 11 estados interactivos × 2 anchos × 2 temas (ver 06).
- 🟡 revisión por un agente independiente lanzada en el tick 2 (resultados en `06-qa-evidence.md` → “Revisión independiente”).

## Fase F — Certificación ⛔ parcial
- Remoto: `db push` de `20260810200000` y `20261014120000`, deploy de EF (`equipment-update`, `incidents`, `planner-action`, `tooling-action`), verificación de policies y conteos → requieren aprobación y acceso de red (hoy sin DNS).
