# Broki — instrucciones de agente

Lee `AGENTS.md` en la raíz del repo. Resumen:

- **Headroom** (siempre): CCR — resumen primero, retrieve solo con query y sin redundancia.
- **Ponytail** (siempre, full): YAGNI, stdlib, mínimo código, sin over-engineering.
- **Caveman** (siempre, wenyan-ultra interno): razonamiento ultra denso; **respuestas en castellano**, estilo caveman, no en chino clásico.

Metodología front/back: `web/` solo UI; lógica de confianza en `supabase/functions/`.
