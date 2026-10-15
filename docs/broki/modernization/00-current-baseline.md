# 00 — Baseline actual (Fase A)

**Fecha:** 2026-10-11 (Fase A) · **actualizado 2026-10-14** (Fases B–E, ver `06-qa-evidence.md`)  
**Rama de trabajo:** `feat/broki-modernization` (creada desde `main` @ `fed84e3`, árbol de trabajo preexistente conservado: 234 entradas staged/unstaged/untracked de la fase anterior, no se han sobrescrito).

## Stack real (verificado con `node -e require(...)`)

| Pieza | Versión instalada |
|---|---|
| Node / npm | 24.14.0 / 11.12.0 |
| Next.js | 16.2.9 (App Router, Turbopack) |
| React | 19.2.4 |
| Tailwind CSS | 4.3.1 (`@theme inline`, `.dark` manual) |
| TypeScript | 5.9.3 |
| @supabase/supabase-js / @supabase/ssr | 2.108.2 / 0.12 |
| @playwright/test | 1.62.1 (chromium 1248 instalado) |
| leaflet | 1.9.4 (solo `/broki/mapa`) |
| @phosphor-icons/react | 2.1.10 |
| sharp | 0.34.5 (dependencia transitiva de Next; usable para optimizar mapas) |
| Deno | 2.9.4 |
| Supabase CLI | 2.109.1 (`node_modules/.bin`) |
| Tests unitarios | `node --test` nativo (no vitest) |

## Rutas Next reales

Dashboard (`web/src/app/broki/(dashboard)/`): `/broki`, `/broki/furgonetas`, `/broki/gse`, `/broki/aviones`, `/broki/incidencias`, `/broki/analytics`, `/broki/planner`, `/broki/roster`, `/broki/fleet`, `/broki/stock`, `/broki/tooling`, `/broki/mapa`.  
Público: `/`, `/registrobroki`, `/login`, legales, `/offline`. Proxy auth: `web/src/proxy.ts` → `lib/supabase/middleware.ts` (redirige `/broki/**` sin sesión a `/login`).

Edge Functions (19): aircraft-action, aircraft-list, broki-import-batch, broki-whatsapp-inbound (gate `WHATSAPP_INBOUND_ENABLED`), equipment-update, incidents, inventory-list, marketing-lead, nitro-stock, personnel-list, personnel-register, planner-action, planner-groups, planner-tasks, relays, roster-upload, tooling-action, tooling-list.  
Auth EF: `_shared/request-auth.ts` → usuario (`auth.getUser` + `broki_user_access` deny-by-default, RBAC viewer/operator/admin) o servicio (HMAC + allowlist por función + idempotencia).  
RPCs: `broki_planner_create_group`, `broki_tooling_checkout` (bloquea `open_checkout_exists`), `broki_tooling_checkin`.

Migraciones: 28 ficheros (`20250615…` → `20260810200000_broki_user_access_rls.sql`).

## Baseline de calidad (ejecutado hoy)

| Check | Resultado |
|---|---|
| `npm run lint` | 0 errores, 1 warning (`ToolingCatalogRow` sin usar en `lib/api/broki.ts`) |
| `tsc --noEmit` | limpio |
| `npm run test:unit` | 25/25 pass |
| `npm run test:integration` (Deno, offline) | todos pass (`12/12 checks`, suites 17/4/20/9/4/8/5) |
| `npm run test:e2e` | **SKIPPED** (sin dev server ni credenciales) |

## Entorno (2026-10-14)

- Docker Desktop (Windows) arrancado desde WSL por interop; Supabase local `127.0.0.1:55321/55322` con 31 migraciones (28 + `20261014120000_broki_tooling_condition.sql`, `20261014150000_broki_incident_open_guard.sql`, `20261014160000_broki_personnel_column_privileges.sql`) y `seed.sql`; `functions serve` activo; usuario QA `qa@broki.test` con `broki_user_access.role=admin`.
- Next dev en `:3100` con `NEXT_PUBLIC_SUPABASE_URL` apuntando al local. **Hallazgo:** Next 16 bloquea assets/HMR para el origen `127.0.0.1` → la app no hidrataba y el login hacía submit nativo; corregido con `allowedDevOrigins: ["127.0.0.1"]` en `web/next.config.ts`.
- Remoto `mjtuxabpjsgggezrsdrw`: sigue **sin DNS** desde este host → RLS remota, conteos y funciones desplegadas permanecen BLOCKED_EXTERNAL.

## Entorno (2026-10-11)

- `web/.env.local` apunta al proyecto remoto `mjtuxabpjsgggezrsdrw`. **Desde esta sesión el host no resuelve DNS** (`Could not resolve host`), el MCP de Supabase devuelve `permission denied` y `supabase migration list --linked` falla la conexión. → Toda verificación remota (RLS aplicada, conteos, functions desplegadas) queda **BLOCKED_EXTERNAL** en esta iteración. No se ha intentado ningún `db push` ni deploy.
- Supabase local (Docker): proyecto `broki` en `127.0.0.1:55321/55322`, arrancado y reseteado con las 28 migraciones + `seed.sql` como **entorno desechable** para E2E con escritura.
- Mapas legacy: `public_html/assets/maps/{t123,t4,t4s}_real.jpg` = 42.7 + 31.0 + 8.6 MB (7016×9935 px). **No existen en `web/public`**: el mapa Next pinta un rectángulo vacío.

## Documentación previa contrastada

`docs/broki/parity/legacy-vs-modern-final.md` declaraba 14 FULL_PASS; `docs/broki/release/20-final-closure-report.md` concluía **NOT READY** (RLS remota no aplicada, secretos sin rotar, E2E release incompleto, dual-write WA). Las auditorías legacy de hoy (ver `01-legacy-feature-matrix.md`) muestran que los inventarios `docs/broki/migration/legacy-*-inventory.md` contenían errores materiales (planner sin parseo PDF cliente, roster con datos mock, mapa sin Leaflet, `normalizeFurgo/GSE` muertos, etc.). Ningún FULL_PASS histórico se hereda.
