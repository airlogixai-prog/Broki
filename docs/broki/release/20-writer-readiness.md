# 20 — Writer / SoT readiness

## Hecho

Dashboard Next escribe `broki_*`.  
WhatsApp producción: ManyChat → n8n → **PG pro.***.

## P0

Cutover Dashboard **sin** redirigir mutaciones WA de assets a Supabase = dual SoT.

## Preferido (antes de cutover UI)

ManyChat → n8n → Edge `equipment-update` / `inventory-list` (Supabase).  
PG deja de ser SoT operativo de furgonetas/GSE.  
`broki-whatsapp-inbound` permanece **off** hasta orquestador+auth webhook.

**Estado:** NOT CLOSED — n8n aún no reescrito a Supabase.
