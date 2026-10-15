# Legacy vs Modern — auditoría final de paridad

**Rol:** Legacy Migration Product Auditor  
**Fecha:** 2026-08-10  
**Fuentes legacy:** `public_html/broki.html`, `public_html/registrobroki.html`, workflows inferidos `PRODUCCION_REGISTROS_DASHBOARD`, `PRODUCCION_FLUJO_PRINCIPAL`, `Desarrollo` (JSON no en repo; red documentada en `docs/broki/migration/legacy-network-inventory.md`)  
**Destino:** Next (`web/`) + Supabase (Edge Functions + `broki_*` + Realtime)

## Leyenda de estados (finales)

| Estado | Significado |
|--------|-------------|
| **FULL_PASS** | Next + Supabase reproduce la operación operativa (input → DB → regla → UI). Se puede planificar retiro de la pieza legacy **para esa operación**. |
| **INTENTIONAL_IMPROVEMENT** | Comportamiento distinto al legacy **a propósito**, documentado y aceptable. No es gap. |
| **BLOCKED** | No se puede retirar la pieza legacy para esa operación: falta orquestación, dual-write, o UI/endpoint live. |

`PARTIAL` **no** es estado final.

---

## Arquitectura de canal WhatsApp (obligatorio)

### ANTES (producción actual mientras n8n esté activo)

```
ManyChat  →  n8n (PRODUCCION_FLUJO_PRINCIPAL / broki_produccion_in)
          →  PostgreSQL legacy (pro.* / public.*)
          →  (opcional) lectura dashboard vía webhooks n8n → broki.html
```

**DB que escribe hoy el flujo WhatsApp productivo:** PostgreSQL legacy detrás de n8n  
**No** Supabase canónico (salvo import batch periódico).

### AHORA — objetivo

```
ManyChat  →  integración (Edge `broki-whatsapp-inbound` u otra)
          →  Supabase canonical (broki_*)
          →  Realtime
          →  Next
```

### Gate actual en código

`supabase/functions/broki-whatsapp-inbound/index.ts`:

- `WHATSAPP_INBOUND_ENABLED !== "true"` → **503** `whatsapp_inbound_not_enabled`
- Mientras el gate esté off: **n8n es el único handler live**
- Con gate on: recibe mensaje, unknown contact / `broki_communications`, **sin** orquestador FURGONETA/GSE/ATENCION (TODO en código)

### Dual-write — política

| Escenario | ¿Permitido? |
|-----------|-------------|
| Hostinger `broki.html` escribe n8n→PG **y** Next escribe Supabase en paralelo **sin** contrato | **NO** — dual-write silencioso prohibido |
| n8n solo importa a Supabase vía `broki-import-batch` (lectura/ETL) | SÍ — no es write operativo dual |
| Cutover: cortar tráfico Hostinger + apuntar ManyChat a EF **después** de feature parity WhatsApp | SÍ — un solo writer operativo |

**Regla:** una operación = un writer operativo documentado. Si coexisten Hostinger y Next, hay que **congelar** uno de los dos para escrituras.

---

## Matriz por operación

| # | Legacy | Input | Legacy DB | Regla | Nuevo endpoint | Nueva tabla | UI | Estado | ¿Retirar legacy? |
|---|--------|-------|-----------|-------|----------------|-------------|-----|--------|------------------|
| 1 | Registro personal | Form `registrobroki.html` → webhook `registro_broky` | `pro.personal` (+ review) | Validación cliente + n8n insert | `personnel-register` | `broki_personnel` (`review_status=pending`) | `/registrobroki` | **FULL_PASS** | Sí, tras cutover DNS/form |
| 2 | Consulta personal | GET `pro_personal` (poll 30s) | `pro.personal` | Lista operadores / quals | `personnel-list` | `broki_personnel` | AppContext (tooling/planner autocomplete) | **FULL_PASS** | Sí (dashboard) |
| 3 | Inventario | GET `pro_inventario` | `pro.inventario` + furgonetas/gse vía normalización client | Split furgo/GSE | `inventory-list` | `broki_assets` | Dashboard / aviones equipos | **FULL_PASS** | Sí |
| 4 | Actualización equipo | POST `Inventario` (parking, worker, estado, fuel…) | `pro.furgonetas` / `pro.gse` / inventario | Update por identificador | `equipment-update` | `broki_assets` | `EquipmentDetailModal` | **FULL_PASS** | Sí |
| 5 | Furgonetas | Subconjunto inventario + UI cards | tablas assets | `normalizeFurgo` | `inventory-list` | `broki_assets` (kind van) | `/broki/furgonetas` | **FULL_PASS** | Sí |
| 6 | GSE | Subconjunto + N₂ pressures | assets GSE | `normalizeGSE` | `inventory-list` | `broki_assets` (kind gse) | `/broki/gse` | **FULL_PASS** | Sí |
| 7 | Incidencias | GET `envio_incidencias` / POST `incidencias` | `pro.incidencias` | Open/close + texto | `incidents` | `broki_incidents` (+ `broki_incident_messages` nativo) | `/broki/incidencias` + modal | **INTENTIONAL_IMPROVEMENT** | Sí dashboard; mensajes hijo = modelo Broki (legacy no tenía tabla mensajes) |
| 8 | Planner groups | GET `envio_grupo_trabajo` / POST `grupotrabajo` | `pro.grupo_trabajo` | Grupos del día + members | `planner-groups` / `planner-action` | `broki_planner_groups` + `_members` | `/broki/planner` | **FULL_PASS** | Sí |
| 9 | Planner tasks | GET `envio_task` / toggle/delete | `pro.tareas` | Attach por matrícula/día | `planner-tasks` / `planner-action` | `broki_planner_tasks` | WorkGroupCard | **FULL_PASS** | Sí |
| 10 | PDF planner | Upload PDF → parse → create | n8n parse + `grupo_trabajo`/`tareas` | Extracción hoja trabajo | `planner-action` (FormData) + `_shared/planner-parse` | groups/tasks | `PlannerCreator` | **FULL_PASS** | Sí |
| 11 | Aviones | GET `envio_avion` (+ CRUD UI Next) | `pro.aviones` | Flota matrícula/aerolínea | `aircraft-list` / `aircraft-action` | `broki_aircraft` | `/broki/aviones` flota | **FULL_PASS** (+ msn/motor) | Sí |
| 12 | Nitro | GET/POST `envio_nitro_stock` | n8n DataTable `nitro_stock` | Botellas llenas/vacías por ubicación | `nitro-stock` | `broki_nitro_stock` | `/broki/stock` | **FULL_PASS** | Sí |
| 13 | Tooling checkout | POST `registro_tooling` | `pro.tool_control` | Prestamo BAC + TMA + avión | `tooling-action` checkout | `broki_tooling_movements` + catalog | `/broki/tooling` | **FULL_PASS** | Sí |
| 14 | Tooling checkin | POST devolución | `pro.tool_control` | Cierre movimiento | `tooling-action` checkin | `broki_tooling_movements` | `/broki/tooling` | **FULL_PASS** | Sí |
| 15 | Horario | POST multipart `horario` + GET semana | n8n store / imports | PDF roster → semana | `roster-upload` | import runs + roster payload | `/broki/roster` | **FULL_PASS** | Sí |
| 16 | Comunicaciones | ManyChat/n8n → registro | `pro.registro_comunicaciones` | Log in/out WhatsApp | (import) + stub inbound → insert | `broki_communications` | **Sin UI dashboard** | **BLOCKED** | No retirar canal WA hasta cutover + UI/ops si se necesita |
| 17 | Chat history | Agente n8n memoria | `pro.n8n_chat_histories` | Session/role/message | solo import/normalize | `broki_chat_histories` | Sin UI | **BLOCKED** | No (agente IA sigue en n8n) |
| 18 | Unknown contacts | Teléfono no en personal | `pro.no_existe_telefono` | Upsert desconocido | inbound stub + import | `broki_unknown_contacts` | Sin UI | **BLOCKED** | No hasta WA live en Supabase |
| 19 | WhatsApp assignment | Intento WA “asignar” equipo | Update `pro.furgonetas`/`gse` vía n8n | NLP/agente + update asset | `broki-whatsapp-inbound` **sin** orchestrator | debería `broki_assets` | Realtime Next (objetivo) | **BLOCKED** | **No** — n8n FLUJO_PRINCIPAL sigue siendo writer |
| 20 | WhatsApp return | Devolver / liberar | Update estado/parking | Agente n8n | idem stub | `broki_assets` | — | **BLOCKED** | No |
| 21 | WhatsApp transfer | Transferir entre workers | Update worker | Agente n8n | idem stub | `broki_assets` | — | **BLOCKED** | No |
| 22 | WhatsApp query | Consulta estado/ubicación | Read PG + reply ManyChat | Agente n8n + ManyChat reply | stub sin reply agent | read `broki_*` (objetivo) | — | **BLOCKED** | No |

---

## Mejoras intencionales (no bloquean retiro dashboard)

| Legacy | Modern | Motivo |
|--------|--------|--------|
| PIN planner `7378` en HTML | Supabase Auth JWT | Seguridad: PIN no es control |
| Relevos solo `localStorage` | EF `relays` + DB | Persistencia multi-dispositivo |
| Poll 30s webhooks públicos | Session + Realtime (+ refresh) | Auth + menos CORS/secretos en browser |
| Webhooks n8n abiertos desde browser | `functions.invoke` con JWT | Frontera de confianza |
| Temas ×6 / browser Notification API | Brand Next + campana in-app | UX product; browser push = YAGNI post-MVP |
| Mapa Leaflet + assets 80MB | Mapa estático + pins | Peso; paridad visual suficiente para ops |
| Dual inventario×2 (esquema external_id) | Cleanup Fase 11 + logical key | Una realidad operacional |

---

## ¿Podemos retirar cada pieza legacy?

### 1. `public_html/broki.html` (dashboard Hostinger)

| Si… | Entonces |
|-----|----------|
| Tráfico UI 100% en Next | **Sí retirar** para ops 1–15 (FULL_PASS / improvement) |
| Alguien sigue abriendo Hostinger y escribe | **No** — dual-write silencioso a PG |

**Retiro condicionado a:** cutover DNS/bookmark + freeze escrituras Hostinger.

### 2. `public_html/registrobroki.html`

**Sí** tras apuntar el formulario público a Next `/registrobroki` (ya FULL_PASS).

### 3. `PRODUCCION_REGISTROS_DASHBOARD` (n8n webhooks dashboard)

**Sí retirar** los webhooks de **lectura/escritura dashboard** (`pro_inventario`, `Inventario`, planner, tooling, nitro, horario, incidencias, personal, aviones) **cuando**:

1. Hostinger ya no llama esos webhooks  
2. Next es el único cliente operativo  
3. Import batch deja de ser necesario en caliente (o queda solo como ETL histórico)

**No** implica retirar el flujo WhatsApp (pieza distinta).

### 4. `PRODUCCION_FLUJO_PRINCIPAL` (ManyChat → n8n → PG)

**No retirar** hasta:

1. `WHATSAPP_INBOUND_ENABLED=true` en producción  
2. Orquestador assignment / return / transfer / query implementado y testeado contra `broki_*`  
3. ManyChat apunta al endpoint Supabase (no a n8n)  
4. Reply ManyChat documentado  
5. Verificación: **cero** writes WhatsApp a PG legacy

Hoy: estados **19–22 BLOCKED**.

### 5. `Desarrollo` / `broki2.html` / webhooks `webhook-test/*`

**Sí retirar** si no hay usuarios; son snapshots/test. No son canónicos de producción.

### 6. PostgreSQL `pro.*` como SoT operativa

**Retiro gradual:**

| Fase | SoT writes |
|------|------------|
| Hoy | PG (dashboard Hostinger + WhatsApp n8n) + Supabase (Next si ya en uso) → **riesgo dual** |
| Post-cutover UI | Supabase canónico para dashboard; PG solo WhatsApp |
| Post-cutover WA | Solo Supabase |

RAW `broki_legacy_rows` **no se borra** como ledger histórico (política Fase 11).

---

## Writer map (anti dual-write silencioso)

| Writer | Destino hoy | Destino objetivo |
|--------|-------------|------------------|
| `broki.html` (Hostinger) | n8n → **PG pro.*** | Apagado |
| Next dashboard | **Supabase broki_*** | Supabase |
| ManyChat | n8n → **PG** | EF → Supabase |
| n8n `broki-import-batch` | Supabase raw (+ normalize) | ETL / backup only |
| n8n FLUJO_PRINCIPAL | **PG** | Apagado tras WA cutover |

Si Next y Hostinger están ambos vivos: **elegir un writer** o aceptar divergencia consciente (no silencioso).

---

## Resumen conteo

| Estado | Ops |
|--------|-----|
| FULL_PASS | 14 (registro, personal, inventario, update, furgo, GSE, groups, tasks, PDF, aviones, nitro, tooling×2, horario) |
| INTENTIONAL_IMPROVEMENT | 1 (incidencias / modelo mensajes) |
| BLOCKED | 7 (comunicaciones UI/live, chat history, unknown live, WA×4) |

**Conclusión producto:**

- El **dashboard operativo** Next + Supabase **ya puede sustituir** `broki.html` + webhooks `PRODUCCION_REGISTROS_DASHBOARD` tras cutover de tráfico y freeze de Hostinger.  
- El **canal WhatsApp** **no** está listo: ManyChat debe seguir en n8n→PG hasta completar `broki-whatsapp-inbound` (orquestación + enable flag + cutover ManyChat).  
- Retirar `FLUJO_PRINCIPAL` antes de eso = pérdida de assignment/return/transfer/query.

---

## Evidencia cruzada

- Endpoints legacy: `docs/broki/migration/legacy-network-inventory.md`  
- Features UI: `docs/broki/migration/legacy-feature-inventory.md`  
- Contrato datos: `docs/broki/migration/data-contract-matrix.md`  
- Cleanup canónico: `docs/broki/data-audit/15-phase11-results.md`  
- Relaciones UUID: `docs/broki/data-audit/16-phase12-domain-relations.md`  
- P0 UI pipeline: `docs/broki/data-audit/17-canonical-to-ui-p0.md`  
- Gate WA: `supabase/functions/broki-whatsapp-inbound/index.ts` L20–L26, L104–L111  

---

## Checklist cutover (orden sugerido)

1. Congelar escrituras Hostinger (o redirect a Next).  
2. Verificar Next sole writer dashboard (smoke + Realtime).  
3. Desactivar webhooks dashboard n8n usados solo por HTML.  
4. Completar WA orchestrator + tests integrity.  
5. Activar `WHATSAPP_INBOUND_ENABLED` en staging → prod.  
6. Reapuntar ManyChat.  
7. Confirmar 0 writes WA a PG.  
8. Archivar `FLUJO_PRINCIPAL` / `REGISTROS_DASHBOARD`.  
9. Mantener `broki_legacy_rows` + backups PG read-only si hace falta auditoría.
