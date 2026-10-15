# 20 — Security readiness

| Item | Status |
|------|--------|
| ZIP `.secrets` histórico | FAIL → ROTATION_REQUIRED |
| Nuevo export + verify | PASS |
| RLS open USING(true) | FIXED in forward migration (pending push) |
| WA inbound gated | PASS (keep false) |
| CORS production origin | PENDING verify hosting |
| Audit fail-open | DOCUMENTED: mutaciones ops continúan si audit falla; admin/import pueden endurecerse después |

**Estado:** NOT CLOSED (rotation + migrate).
