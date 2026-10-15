# Fase 0 — baseline protegido

Fecha: 2026-08-04  
HEAD al cerrar: ver `git log -1`  
Estados de paridad: solo `FULL_PASS` | `INTENTIONAL_IMPROVEMENT` | `BLOCKED` (sin `PARTIAL` final).

## Runtime capturado

| Item | Valor |
|------|-------|
| Branch | `main` (ahead de `origin/main`) |
| Node | v24.14.0 |
| npm | 11.12.0 |
| Next | 16.2.9 (`web/package.json`) |
| React | 19.2.4 |
| Supabase project (remoto) | `mjtuxabpjsgggezrsdrw` |
| Legacy canónico | `public_html/broki.html` (7529 líneas) |
| Legacy secundario | `public_html/broki2.html` |

## Working tree al inicio

- 73 archivos modificados, ~+2656/−1043 vs HEAD `8d9e738`
- 57 untracked (docs migración, scripts, EF nuevas, UI, migraciones SQL)
- `web/.env.local` presente y gitignored (OK)
- Scan secretos: solo menciones de rol `service_role` / grants — sin claves

## Riesgos corregidos en Fase 0

1. `public_html/` estaba 100% ignorado → `broki.html` + `broki2.html` ahora versionados.
2. Tests web (`*.test.ts`, `e2e/`, playwright config) estaban ignorados → versionados (evidencia).
3. `.env.example` caía bajo `.env.*` → excepción `!.env.example` / `!web/.env.example`.

## Tests baseline

```
npm run test:unit → 20 pass / 0 fail
```

`test:integration`: no ejecutado en cierre Fase 0 (hook precommit lo corrió parcial antes del abort E2E).

`test:e2e`: **BLOCKED**. Servidor en `:3000` activo → hook intenta Playwright. Login con `qa@broki.test` / `brokiqa1234` queda en `/login` (timeout 30s). Commit abortado; no se usó `--no-verify` ni `BROKI_SKIP_E2E`.

### Desbloqueo commit (elige 1)

1. Credenciales E2E válidas (`E2E_EMAIL` / `E2E_PASSWORD`) para el Supabase al que apunta `web/.env.local`.
2. Autorización explícita de snapshot Fase 0 con `HUSKY=0` / `--no-verify` (solo este commit).
3. Crear usuario QA en Auth y reintentar hook.

Durante el hook fallido, 4 archivos root (`*V3*`) pasaron a `AD` (index OK / worktree borrado). Restaurados con `git restore`.

## Inventarios ya presentes (no reescritos)

- `legacy-feature-inventory.md`
- `legacy-ui-inventory.md`
- `legacy-network-inventory.md`
- `legacy-route-inventory.md`
- `legacy-storage-inventory.md`
- `data-contract-matrix.md`
- `config/broki/legacy-field-map.json`

## Notas operativas

- Terminal local puede usar `pnpm`; repo oficial = **npm** (`ci:install` falla si hay lockfiles ajenos).
- n8n = contrato legacy / import datos; **no** runtime del dashboard Next.
- Matriz de paridad funcional UI: `parity-status.md` (seed Fase 0).

## Siguiente

Fase 1 solo tras este commit limpio. No declarar feature migrada sin comportamiento + contrato + validación + estados + test + evidencia.
