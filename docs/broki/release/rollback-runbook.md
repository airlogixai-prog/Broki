# Rollback Runbook — BROKI

Rollback **por canal**. Un fallo de Dashboard no implica reactivar WhatsApp en un destino distinto al que tenía.

---

## Principios

1. Un writer operativo por dominio (no dual-write silencioso al revertir).
2. RAW `broki_legacy_rows` no se borra en rollback UI.
3. Preferir revertir tráfico antes que “arreglar en caliente” sin owner.
4. Este documento **no** sustituye un drill. Estado drill: **no ejecutado en prod** (2026-08-10).

---

## R-A — Rollback DASHBOARD (Next → Hostinger/n8n)

### Cuándo

- Next down / Auth down / Edge dashboard failing
- Corrupción canónica detectable en ops UI
- Cutover A fallido en post-check

### Pasos (orden)

1. **Tráfico UI**  
   - DNS/bookmarks otra vez a `broki.html` (Hostinger) **o** página de mantenimiento.  
   - Confirmar usuarios no escriben en Next.

2. **Rehabilitar webhooks n8n dashboard** (si se deshabilitaron en A3)  
   - Solo los necesarios para Hostinger.  
   - Destino: PostgreSQL legacy `pro.*` como antes del cutover.

3. **Supabase**  
   - No drop de tablas.  
   - Opcional: feature flag / deny writes en Edge dashboard si existe.  
   - Datos escritos en Next durante ventana A quedan en `broki_*` (reconciliar después; no merge ciego).

4. **Comunicar**  
   - “Dashboard revertido a legacy; WhatsApp no cambia.”

5. **Post-rollback check**  
   - Login Hostinger  
   - Write furgoneta/GSE  
   - Una incidencia  
   - Tooling checkout  

### Datos

- Canonical post-A puede haber avanzado respecto a PG.  
- Tras rollback UI: PG es writer ops otra vez → planear **delta import** a Supabase cuando se reintente cutover (no full blind).

### F11 cleanup

- No re-ejecutar merge/delete en pánico.  
- Audit `broki_canonical_cleanup_audit` sirve para restore puntual de filas borradas, no para “undo cutover”.

---

## R-B — Rollback WHATSAPP (Edge → n8n)

### Cuándo

- Inbound Edge 5xx / orquestador incorrecto  
- ManyChat sin respuesta  
- Writes WA a destino equivocado

### Pasos

1. ManyChat: apuntar otra vez a n8n `PRODUCCION_FLUJO_PRINCIPAL`.  
2. Set `WHATSAPP_INBOUND_ENABLED≠true` (o quitar secreto) en Supabase secrets.  
3. Confirmar n8n escribe otra vez en PG.  
4. **No** tocar cutover Dashboard si estaba estable.  
5. Mensajes ya insertados en `broki_communications` durante B: dejar; reconciliar offline.

---

## R-C — Auth / secretos

| Síntoma | Acción |
|---------|--------|
| Login masivo fallando | Revisar Supabase Auth; no rotar service_role en caliente sin checklist |
| 401 Edge | Verificar `BROKI_*` secrets; `secrets:check` |
| Sospecha leak service_role | Rotar en Dashboard → actualizar Edge/n8n/`.env.local` → redeploy |

---

## R-D — Smoke residues tras fallo de test

```bash
npm run test:remote:cleanup
node scripts/cleanup-broki-test-residues.mjs --dry-run
node scripts/cleanup-broki-test-residues.mjs   # solo alta confianza
```

---

## Drill (obligatorio antes de READY)

| # | Escenario | Entorno | Owner | Fecha | Resultado |
|---|-----------|---------|-------|-------|-----------|
| 1 | R-A tráfico UI | staging | | | pendiente |
| 2 | R-B ManyChat flip | staging | | | pendiente |
| 3 | Secret rotate | staging | | | pendiente |

Sin filas “OK” arriba → **no** declarar READY pleno.

---

## Contactos / ownership (rellenar)

- Release manager:  
- On-call dashboard:  
- On-call WhatsApp/n8n:  
- Data owner (parity/delta):  
