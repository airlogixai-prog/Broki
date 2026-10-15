# Final Production Readiness — BROKI (updated F20)

**Veredicto:** **NOT READY**  
Ver `20-final-closure-report.md`.

## Gates código (repo)

Scripts: `release:verify`, `test:e2e:release`, `export:verify`, `functions:verify-manifest`.

No declarar READY por build verde.

## Cutover

Dashboard UI ≠ WhatsApp.  
Shared assets SoT debe ser único (Supabase) **antes** de cutover Dashboard.

## Secrets

ROTATION_REQUIRED por ZIP `Broki-export-20260810-185613.zip`.  
Plan: `docs/broki/security/secret-rotation-plan.md`.
