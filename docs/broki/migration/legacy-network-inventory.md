# Inventario de red — legacy BROKI

> Webhooks n8n, `fetch`, APIs externas y mapeo a Edge Functions Next. Sin implementar migración.

## Fuentes

- `public_html/broki.html` (canónico)
- `public_html/broki2.html` (endpoints reducidos)
- `public_html/registrobroki.html`
- `web/src/lib/api/broki.ts`
- `docs/broki/migration/n8n-to-supabase.md`
- Workflows `PRODUCCION_*.json` / `Desarrollo.json`: **no disponibles en repo**

---

## 1. Objeto `ENDPOINTS` (broki.html)

```javascript
const ENDPOINTS = {
  INVENTORY:          'https://n8n.airlogixai.com/webhook/pro_inventario',
  PERSONAL:           'https://n8n.airlogixai.com/webhook/pro_personal',
  REPORT_INCIDENT:    'https://n8n.airlogixai.com/webhook/incidencias',
  GET_INCIDENTS:      'https://n8n.airlogixai.com/webhook/envio_incidencias',
  UPDATE_EQUIPMENT:   'https://n8n.airlogixai.com/webhook/Inventario',
  PLANNER_CREATE:     'https://n8n.airlogixai.com/webhook/grupotrabajo',
  PLANNER_GET_GROUPS: 'https://n8n.airlogixai.com/webhook/envio_grupo_trabajo',
  PLANNER_GET_TASKS:  'https://n8n.airlogixai.com/webhook/envio_task',
  GET_AIRCRAFT:       'https://n8n.airlogixai.com/webhook/envio_avion',
  UPLOAD_ROSTER:      'https://n8n.airlogixai.com/webhook/horario',
  GET_NITRO_STOCK:    'https://n8n.airlogixai.com/webhook/envio_nitro_stock',
};
```

### Diferencia `broki2.html`

- `UPDATE_EQUIPMENT` apunta a `webhook-test/Inventario` (entorno test).
- Sin `GET_AIRCRAFT`, `UPLOAD_ROSTER`, `GET_NITRO_STOCK` en el objeto (tabs ausentes).

---

## 2. Endpoints adicionales (fuera de `ENDPOINTS`)

| Constante | URL | Uso |
|-----------|-----|-----|
| `TOOLING_ENDPOINT` | `https://n8n.airlogixai.com/webhook/tooling` | GET catálogo herramientas |
| `REGISTRO_TOOLING_ENDPOINT` | `https://n8n.airlogixai.com/webhook/registro_tooling` | GET movimientos + POST check-in/out |
| `PERSONAL_ENDPOINT` | `= ENDPOINTS.PERSONAL` | Autocomplete tooling |
| `AIRCRAFT_ENDPOINT` | `= ENDPOINTS.GET_AIRCRAFT` | Select aviones tooling |
| Hardcoded delete task | `https://n8n.airlogixai.com/webhook/grupotrabajo` | POST `{ action: 'delete_task', ... }` |

### Registro personal (`registrobroki.html`)

| URL | Método |
|-----|--------|
| `https://n8n.airlogixai.com/webhook/registro_broky` | POST JSON (formulario completo + metadata legal) |

Función de prueba en consola: `testWebhook()`.

---

## 3. `fetchData()` — lecturas en paralelo (poll cada 30s)

| # | Legacy fetch | Cache-bust |
|---|--------------|------------|
| 1 | `ENDPOINTS.INVENTORY` | No |
| 2 | `ENDPOINTS.PERSONAL` | `?_ts=` |
| 3 | `ENDPOINTS.PLANNER_GET_GROUPS` | `?_ts=` |
| 4 | `ENDPOINTS.PLANNER_GET_TASKS` | `?_ts=` |
| 5 | `ENDPOINTS.GET_INCIDENTS` | `?_ts=` |
| 6 | `ENDPOINTS.GET_AIRCRAFT` | `?_ts=` |
| 7 | `ENDPOINTS.GET_NITRO_STOCK` | `?_ts=` |

**Auth:** ninguna cabecera; webhooks n8n públicos desde el browser.

**Error handling:** inventario falla → banner `#error-banner`; resto → `[]` o `null` silencioso.

---

## 4. `sendWebhook()` — enrutado de escrituras

Función central (~L5862). Infiere destino por campos del payload:

| Condición payload | Webhook destino |
|-------------------|-----------------|
| `identificador` / update equipo | `ENDPOINTS.UPDATE_EQUIPMENT` |
| `grupo` / planner create | `ENDPOINTS.PLANNER_CREATE` |
| incidencia | `ENDPOINTS.REPORT_INCIDENT` |
| default | `ENDPOINTS.PLANNER_CREATE` |

También existe `sendWebhook(payload, url)` para URL explícita (p. ej. `UPDATE_EQUIPMENT`).

**Método:** POST `Content-Type: application/json`.

### Otras escrituras directas

| Acción | Endpoint | Body destacado |
|--------|----------|----------------|
| Subir roster PDF | `UPLOAD_ROSTER` | `FormData` multipart |
| Stock nitrógeno | `sendWebhook` → nitro | campos botellas |
| Relevos | **solo `localStorage`** (`relays_db`) — sin webhook en create/delete |
| Tooling check-in/out | `REGISTRO_TOOLING_ENDPOINT` | POST movimiento |
| Planner PDF upload | `grupotrabajo` vía `sendWebhook` | multipart / parsed tasks |

---

## 5. APIs externas (no n8n)

| Servicio | URL patrón | Uso legacy |
|----------|------------|------------|
| Open-Meteo | `api.open-meteo.com/v1/forecast?...` LEMD | Clima dashboard + alertas |
| ApexCharts | `cdn.jsdelivr.net/npm/apexcharts` | Gráficos analytics |
| Leaflet | `unpkg.com/leaflet@1.9.4` | Mapa en vivo |
| Tailwind CDN | `cdn.tailwindcss.com` | Estilos runtime |
| Phosphor Icons | `unpkg.com/@phosphor-icons/web@2.1.1` | Iconografía |
| Google Fonts | Inter | Tipografía |

### Next equivalente

| Legacy | Next |
|--------|------|
| Open-Meteo inline | `web/src/lib/api/weather.ts` → `fetchLemdWeather()` |
| ApexCharts | Por verificar en `/broki/analytics` (migración parcial) |
| Leaflet | Mapa estático con pins (`mapa/page.tsx`); sin Leaflet dep |
| Tailwind CDN | Tailwind 4 build-time |

---

## 6. Mapeo legacy webhook → Edge Function Supabase

| Webhook n8n (legacy) | Edge Function (Next) | Método |
|----------------------|----------------------|--------|
| `pro_inventario` | `inventory-list` | GET |
| `pro_personal` | `personnel-list` | GET |
| `envio_avion` | `aircraft-list` | GET |
| `envio_incidencias` / `incidencias` | `incidents` | GET / POST |
| `Inventario` | `equipment-update` | POST |
| `envio_grupo_trabajo` | `planner-groups` | GET |
| `envio_task` | `planner-tasks` | GET |
| `grupotrabajo` | `planner-action` | POST (+ FormData PDF) |
| `horario` | `roster-upload` | GET / POST |
| `envio_nitro_stock` | `nitro-stock` | GET / POST |
| `tooling` + `registro_tooling` | `tooling-list` + `tooling-action` | GET / POST |
| `registro_broky` | `personnel-register` | POST |
| — (import batch n8n) | `broki-import-batch` | POST (server-to-server) |
| WhatsApp | `broki-whatsapp-inbound` | **No tocar** |

**Auth Next:** JWT Supabase (`verify_jwt=true`) en dashboard; service-auth en backend para smoke/n8n.

---

## 7. Workflows n8n productivos (inferidos, no inspeccionados)

Referencias en `supabase/migrations/20260617213000_broki_core_schema.sql`:

- `PRODUCCION_REGISTROS_DASHBOARD` — tablas `pro.*` de lectura/escritura dashboard
- `PRODUCCION_FLUJO_PRINCIPAL` — flujo principal sincronización

Tablas origen documentadas en `n8n-to-supabase.md` y `config/broki/n8n-source-tables.json`:

`pro.personal`, `pro.inventario`, `pro.incidencias`, `pro.grupo_trabajo`, `pro.tareas`, `pro.aviones`, `pro.tooling`, `pro.tool_control`, `pro.furgonetas`, `pro.gse`, `pro.registro_comunicaciones`, DataTable `nitro_stock`, etc.

**Política repo:** no modificar workflows `PRODUCCION_*`; migración vía workflows nuevos + `broki-import-batch`.

---

## 8. Polling y timers de red

| Timer | Intervalo | Función |
|-------|-----------|---------|
| `refreshInterval` | 30s | `fetchData()` |
| `setInterval` notificaciones | 2 min | `checkAndNotify` |
| `setInterval` | 120s | re-evalúa alertas críticas |
| `updateNotifications` | +2s al load | primera pintura campana |

Next: `useEquipment` hook + `autoRefresh` en `AppContext` (30s cuando activo).

---

## 9. Independencia n8n (post-migración backend)

Smoke test `supabase/functions/_tests/smoke.ts` verifica que **ninguna** Edge Function del dashboard (excepto `broki-whatsapp-inbound`) referencia `n8n` en código.

El **frontend legacy** sigue llamando n8n directamente en producción Hostinger hasta cutover.

---

## 10. Riesgos de red observados

1. **Webhooks públicos** desde browser — sin secret en legacy.
2. **PIN planner `7378`** en fuente — no es control de red.
3. **Relevos solo local** — no persisten en backend legacy.
4. **`broki2` mezcla test/prod** en `UPDATE_EQUIPMENT`.
5. **CORS** dependiente de configuración n8n; Next evita CORS al usar `supabase.functions.invoke`.
