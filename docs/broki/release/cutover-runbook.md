# Cutover Runbook — BROKI

**Separación obligatoria:** DASHBOARD ≠ WHATSAPP.  
No apagar n8n/ManyChat únicamente porque Next esté desplegado.

---

## Precondiciones comunes

- [ ] Veredicto readiness ≠ `NOT READY` para el canal que se corta (ver `final-production-readiness.md`)
- [ ] Backup / export RAW snapshot etiquetado
- [ ] Rollback runbook leído; owner de rollback asignado
- [ ] Canal de comunicación ops (quién avisa a turnos)

---

## A — Cutover DASHBOARD (Next = único writer UI)

### A0. Criterio de entrada

- E2E dashboard completo PASS (sin skips)
- Remote smoke + cleanup PASS
- Canonical/relations/runtime PASS
- Source parity PASS **o** excepción firmada por data owner
- Hostinger `broki.html` traffic inventory conocido

### A1. Freeze Hostinger (escrituras)

1. Anunciar ventana.
2. Poner `broki.html` / bookmarks en **solo lectura** o redirigir a Next.
3. Confirmar: **cero** POSTs desde Hostinger a webhooks `PRODUCCION_REGISTROS_DASHBOARD`.

### A2. DNS / acceso UI

1. Apuntar URL operativa dashboard a Next (Vercel/host).
2. Verificar login + Furgonetas + GSE + write equipo + incidencias + tooling.
3. Verificar Realtime indicator / refresh.

### A3. n8n dashboard webhooks

1. **No** borrar aún: marcar workflows dashboard como deprecated.
2. Deshabilitar webhooks de **escritura** usados solo por `broki.html`.
3. Dejar `broki-import-batch` como ETL/histórico si hace falta (no writer ops dual).

### A4. Post-check (T+30m / T+24h)

- Conteos canónicos estables
- Sin dual-write (Next vs PG) en assets/incidents/planner/tooling
- Residuos smoke = 0

### A5. Qué NO tocar en cutover Dashboard

- ManyChat
- `PRODUCCION_FLUJO_PRINCIPAL`
- PostgreSQL legacy como destino WhatsApp
- Edge `broki-whatsapp-inbound` (sigue gated)

---

## B — Cutover WHATSAPP (solo después de Dashboard estable)

### B0. Criterio de entrada

- Dashboard cutover estable ≥ N días (acordar)
- `WHATSAPP_INBOUND_ENABLED=true` en prod
- Orquestador assignment / return / transfer / query → `broki_*` testeado
- Reply ManyChat documentado
- Dual-write PG+Supabase **prohibido** en go-live

### B1. Secuencia

1. Shadow / dry-run inbound (sin cortar ManyChat).
2. Apuntar ManyChat al Edge Function Supabase.
3. Verificar writes solo en `broki_*` (communications, assets, unknown contacts).
4. Deshabilitar n8n FLUJO_PRINCIPAL writes a PG.
5. Monitoreo 24–72h; rollback listo (runbook §B).

### B2. Prohibiciones

- No cortar ManyChat “porque el dashboard Next funciona”.
- No activar inbound sin orquestador.
- No dejar n8n y Edge escribiendo el mismo dominio a la vez.

---

## Writer map (anti dual-write)

| Writer | Durante A (Dashboard only) | Tras B (WA too) |
|--------|----------------------------|-----------------|
| Next | Supabase `broki_*` | Supabase |
| Hostinger broki.html | **OFF** | OFF |
| ManyChat → n8n → PG | **ON** (WA) | OFF |
| ManyChat → Edge | OFF | **ON** |
| n8n import-batch | ETL only | ETL only |

---

## Comunicación de estado

| Fase | Mensaje ops |
|------|-------------|
| Pre-A | “UI nueva en Next; Hostinger se congela; WhatsApp igual” |
| A done | “Dashboard solo Next/Supabase; WhatsApp sigue n8n” |
| B done | “WhatsApp también en Supabase; n8n FLUJO apagado” |
