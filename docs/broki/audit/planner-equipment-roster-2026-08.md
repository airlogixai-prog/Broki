# Auditoría Planificador, Equipos, Modal y Horario

**Fecha:** 2026-08-04 | **Autor:** Principal Engineer audit (no-code phase)

---

## 1. Estado del repositorio

| Señal | Valor |
|-------|-------|
| HEAD | `8d9e738` — feat(security): service auth for edge functions |
| Working tree | 70 archivos modificados + ~20 untracked (migraciones 20260802*, `scripts/`, docs/migration, componentes UI/PWA) |
| Últimas commits relevantes | parity audit, operational atomic, marketing leads, service auth |

La auditoría refleja el **working tree** actual, no solo el HEAD. Cambios en planner, roster, equipment y edge functions están en curso sin commit.

---

## 2. Verificación local

| Comando | Resultado |
|---------|-----------|
| `npm run test:unit` | **20/20 OK** |
| `npm run test:integration` | **12/12 OK** (offline, `SMOKE_OFFLINE_ONLY=1`) |
| `npm run lint` | **OK** |
| `npm run build` | **OK** — `/broki/planner`, `/broki/roster` en build output |
| `npm run test:remote` | No ejecutado — requiere `ALLOW_REMOTE_WRITE_TESTS=true` y escribe en prod |

---

## 3. Arquitectura de flujo de datos

```
Browser (Next.js)
  └─ lib/api/broki.ts  ──────────────────────────────────────────────────────┐
       ├─ GET  planner-groups       → broki_planner_groups + _group_members   │
       ├─ GET  planner-tasks        → broki_planner_tasks                      │
       ├─ POST planner-action       → create / delete / toggle_task /          │
       │                               delete_task / update_task /             │
       │                               create_task / PDF multipart import      │
       ├─ GET  roster-upload?week=  → broki_roster_assignments (por period_id) │
       ├─ POST roster-upload        → PDF → parse → broki_roster_*             │
       └─ POST equipment-update     → broki_assets                             │
                                                                               │
Supabase Edge Functions (_shared/)                                            │
  ├─ handler.ts   — CORS + serve wrapper                                       │
  ├─ pdf.ts       — SHA-256, extractPdfText (unpdf), looksScanned, OpenAI     │
  ├─ planner-parse.ts  — parsePlannerText (heurístico) + aiPayloadToTasks     │
  ├─ roster-parse.ts   — parseRosterText + normalizeShift                     │
  ├─ request-auth.ts   — user JWT + service HMAC auth                         │
  └─ response.ts  — jsonResponse helper                                        │
                                                                               │
Postgres                                                                       │
  ├─ broki_planner_groups          (id_avion, modelo, vehiculo, responsable,  │
  │                                 hora_salida, hora_llegada, import_run_id) │
  ├─ broki_planner_group_members   (group_id, position, worker_text)          │
  ├─ broki_planner_tasks           (group_id, tipo_tarea, codigo,             │
  │                                 matricula_avion, prioridad, descripcion,  │
  │                                 notas, estado, fecha, import_run_id)      │
  ├─ broki_planner_import_runs     (file_hash UNIQUE, status, created_count)  │
  └─ broki_roster_periods / _assignments / _import_runs                       │
```

---

## 4. Contrato DB ↔ API ↔ UI

### 4.1 `broki_planner_groups` → `planner-groups` GET → `WorkGroup`

| DB column | JSON key (API) | UI type `WorkGroup` | Notas |
|-----------|---------------|---------------------|-------|
| `id` | `id` | `id: string` | UUID |
| `id_avion` | `id_avion` | `matricula: string` | normalizado a mayúsculas en UI |
| `modelo` | `modelo` | `modelo: string` | |
| `aerolinea` | `aerolinea` | `aerolinea: string` | |
| `vehiculo` | `vehiculo` | `furgo: string` | |
| `responsable` | `responsable` | `responsable: string` | |
| `hora_salida` | `hora_salida` | `salida: string` | timestamptz → formatTime en UI |
| `hora_llegada` | `hora_llegada` | — | no en WorkGroup, usado en form |
| `fecha_modificacion` | `fecha_modificacion` | — | filtra "solo hoy" en mergePlannerData |
| `members[]` | `members[].worker_text` | `workers: string[]` | join server-side en planner-groups |

### 4.2 `broki_planner_tasks` → `planner-tasks` GET → `WorkTask`

| DB column | JSON key (API) | UI type `WorkTask` | Notas |
|-----------|---------------|---------------------|-------|
| `id` | `id` | `db_id: string` | UUID; requerido para toggle/delete |
| `tipo_tarea` | `tipo_tarea` | `type: string` | MEL, CDL, PREVUELO… |
| `codigo` | `codigo` | `code: string` | clave de dedup front + DB |
| `prioridad` | `prioridad` | `priority: string` | NO_GO / CRITICAL / NORMAL… |
| `descripcion` | `descripcion` | `desc: string` | |
| `notas` | `notas` | `notes?: string` | |
| `estado` | `estado` | `done: boolean` | `Number(estado) === 1` |
| `fecha` | `fecha` | — | filtra "solo hoy" en mergePlannerData |
| `matricula_avion` | `matricula_avion` | — | join con grupo por matrícula normalizada |

### 4.3 Dedup DB

Índice único `broki_planner_tasks_dedup_idx`:
```sql
(upper(regexp_replace(coalesce(matricula_avion,''),'[^A-Za-z0-9]','','g')), codigo, ((fecha at time zone 'UTC')::date))
WHERE codigo IS NOT NULL AND fecha IS NOT NULL
```
Error `23505` → incrementa `duplicates` en la respuesta del import. No aborta.

---

## 5. Planificador — estado actual del parser

### `parsePlannerText` (heurístico)

Archivo: `supabase/functions/_shared/planner-parse.ts`

**Entradas:** texto plano extraído con `unpdf`. Trabaja línea a línea.

**Detección de tarea:** regex `TASK_CODE = /\b([A-Z]{2,5}[-/]\d{3,6})\b/`  
— requiere separador `-` o `/` entre prefijo y número.

**Campos extraídos por línea:**

| Campo | Cómo | Limitación |
|-------|------|-----------|
| `codigo` | `TASK_CODE` match | Sin separador → no detecta |
| `tipo_tarea` | Keywords en línea (MEL, CDL, PREVUELO…) | No lee columna separada |
| `prioridad` | Keywords (NO_GO, CRITICAL, GO_IF, NORMAL) | No lee columna |
| `descripcion` | Línea menos código/matrícula/prioridad | Mezcla con otras columnas si PDF tabla |
| `matriculaAvion` | `REGISTRATION` regex en línea o header | No columna A/C |
| `fecha` | `findDate` en línea o header | |
| **`estado`** | **Siempre `0`** | **No lee columna "Realizado"** |

**Fixture actual** (`supabase/functions/_tests/fixtures/pdf.ts`):
```
HOJA DE TRABAJO
MATRICULA: EC-NFP
...
MEL-2201 NO GO Revision tren principal derecho
DEF-0075 NORMAL Cambio filtro hidraulico
```
Formato línea libre — **no tabla**.

**Pipeline completo:**
1. Hash SHA-256 → idempotencia (`broki_planner_import_runs.file_hash UNIQUE`)
2. `extractPdfText` (unpdf, copia del buffer para no invalidar hash)
3. `parsePlannerText` → si `tasks.length > 0`, usar resultado
4. Si vacío + `looksScanned` → error 422
5. Si vacío + texto presente → `openAiJson` con schema estructurado (requiere `OPENAI_API_KEY`)
6. Si AI no configurada → import vacío, sin error explícito al usuario

---

## 6. Gap: PDF real `daily_workload_01Aug20260813_revision_3.pdf`

El documento real contiene una **tabla** con columnas definidas y una segunda página de notas generales.

### 6.1 Columnas identificadas

| Columna PDF | Parser actual | Estado del gap |
|-------------|--------------|----------------|
| Tipo | Regex libre en línea | ❌ No lee columna; falla si el tipo no aparece como keyword |
| Código | `TASK_CODE` con `-`/`/` | ⚠️ Falla si código sin separador o en columna separada |
| A/C | `REGISTRATION` en cualquier posición | ⚠️ No mapea columna; puede tomar matrícula de otra columna |
| Prioridad | Keywords en línea | ❌ No lee columna |
| Descripción | Resto de línea tras eliminar tokens | ⚠️ Contaminada con contenido de otras columnas si el PDF usa tabulación/espacios |
| **Realizado** | **`estado: 0` siempre** | ❌ **No importado en ningún caso** |
| Página 2 notas | Líneas sin `TASK_CODE` → skip | ✅ Normalmente seguro; riesgo si notas contienen códigos tipo `MEL-XXXX` |

### 6.2 XLSX (`DAILY PRIORITY 01 AUG 26 @MADBRK (1).xlsx`)

- **Cero soporte** en todo el stack actual.
- `PlannerCreator` acepta solo `application/pdf` (via `PdfDropZone`).
- Edge function `planner-action` lanza error si los bytes no empiezan por `%PDF-`.
- Requiere decisión: ¿procesar XLSX en front antes de enviar, o añadir parser XLSX en edge function?

### 6.3 Riesgos de TZ / calendario

`mergePlannerData` en el front filtra usando `isSameCalendarDay` con `new Date()` local del browser.  
Una sesión abierta pasada medianoche muestra groups de ayer hasta que recarga. Edge case: zona horaria del browser ≠ UTC del servidor → fecha UTC midnight puede caer en día anterior.

---

## 7. Tarjetas de equipos

### Componentes

| Archivo | Rol |
|---------|-----|
| `web/src/components/equipment/EquipmentCard.tsx` | Tarjeta: status badge, ubicación, worker, avión, fuel bar, botellas N₂ |
| `web/src/components/equipment/EquipmentGrid.tsx` | Grid responsive, estado loading/vacío |
| `web/src/components/equipment/EquipmentListPage.tsx` | Wrapper: h1 + FilterBar + EquipmentGrid |
| `web/src/components/equipment/FilterBar.tsx` | Filtros texto/avión/estado/familia desde AppContext |
| `web/src/components/equipment/KpiWidgets.tsx` | KPIs: disponibles/en uso/inoperativos |

### Datos

`useEquipment` (hook) → `Promise.allSettled([inventory-list, personnel-list, incidents, aircraft-list])`.  
Fallos parciales aceptados: muestra datos incompletos con error en UI.  
Realtime en `broki_assets`, `broki_incidents`, `broki_incident_messages`; polling fallback 30s.

### Mappers

`lib/mappers/equipment.ts`:
- `splitInventory`: separa `furgonetas` (familia FURGONETA/VEHICULO) de `gse`
- `getFamily`: clasifica por descripción → fallback por prefijo id
- `getStatusCategory`: evita bug "INOPERATIVO" contiene "OPERATIVO" con orden explícito
- `normalizeFurgo`, `normalizeGSE`, `normalizePersonnel`, `normalizeAircraft`

Testeados en `mappers.test.ts` (20 tests, todos pasan).

---

## 8. Modal de detalle de equipo

| Archivo | Rol |
|---------|-----|
| `web/src/components/modals/EquipmentDetailModal.tsx` | Modal completo: view + edit + incidencias |
| `web/src/lib/hooks/useEquipmentModal.tsx` | Host con deep link `?equipo=<id>` via router |
| `web/src/components/modals/IncidentSection.tsx` | Sección incidencias dentro del modal |

### Flujo edición (optimista con rollback)

```
handleEdit()
  → setDraft({ itemId, state: toEdit(item) })

handleSave()
  → validateEquipmentForm(editState)    // front: UX
  → patchEquipment(id, patch)           // AppContext optimista
  → brokiApi.updateEquipment(payload)   // POST equipment-update
    ↳ OK  → refreshRef() + setDraft(null)
    ↳ ERR → restoreInventory(snapshot) + setSaveError
```

### Campos

| Tipo equipo | Campos editables |
|-------------|-----------------|
| GSE | parking, avión, operario, notas, estado |
| Furgo | ubicación, avión, operario, combustible%, adblue%, notas |
| Nitrógeno (GSE) | + botella_1..4 (PSI) |

El smoke test verifica que `parking` de GSE **no sobreescribe** `ubicacion_habitual`.

---

## 9. Horario (Roster)

### UI

`web/src/app/broki/(dashboard)/roster/page.tsx` (~500 líneas inline, sin componentes separados):

- Modos: `weekly` / `daily`
- Filtro aerolínea: `all` / `iberojet` / `w2f`
- Navegación semanal con `mondayOf` + `shiftWeek`
- `getShiftStyle`: estilos por código de turno + airline del dato importado (no índice hardcoded)
- Upload PDF → `brokiApi.rosterUpload(formData)` → recarga

### Backend (`roster-upload`)

| Método | Comportamiento |
|--------|---------------|
| `GET ?week=YYYY-MM-DD` | Periodo exacto → fallback al más reciente (`isFallback: true`) |
| `POST multipart` | Hash SHA-256 → idempotencia → `parseRosterText` → AI fallback → upsert assignments |

Parser `roster-parse.ts`: extrae 7 tokens de turno desde la derecha de cada línea; texto izquierdo → nombre/código/cert.

---

## 10. Mapa de tests existentes

| Área | Archivo | Qué cubre | Ejecuta en |
|------|---------|-----------|-----------|
| Mappers front + planner merge | `web/src/lib/mappers/mappers.test.ts` | Hoy/stale, dedup, workers, non-array | `npm run test:unit` |
| Equipment clasificación | `web/src/lib/mappers/equipment.test.ts` | getFamily, getStatusCategory, normalizadores | `npm run test:unit` |
| Filtros | `web/src/lib/equipment/filters.test.ts` | Filtro texto/avión/estado | `npm run test:unit` |
| PDF boundary front | `web/src/lib/pdf/validate.test.ts` | MIME, tamaño | `npm run test:unit` |
| Preferences | `web/src/lib/preferences/storage.test.ts` | localStorage | `npm run test:unit` |
| Realtime channel key | `web/src/lib/realtime/channelKey.test.ts` | key gen | `npm run test:unit` |
| planner-parse self-check | `supabase/functions/_shared/planner-parse.ts` `if (import.meta.main)` | Líneas MEL/DEF, phantom header, AI dedup | `npm run test:integration` |
| roster-parse self-check | `supabase/functions/_shared/roster-parse.ts` | 7 shifts/línea, normalizeShift | `npm run test:integration` |
| Service auth HMAC | `supabase/functions/_tests/service-auth.test.ts` | 17 casos | `npm run test:integration` |
| Smoke offline PDF pipeline | `supabase/functions/_tests/smoke.ts` | fixture syntético, no PDF real | `npm run test:integration` |
| Smoke live | `supabase/functions/_tests/smoke.ts` | CRUD planner, PDF import idempotencia | `npm run test:remote` (requiere DB) |

**Ausente:** ningún test con `daily_workload_*.pdf` ni con `*.xlsx`.

---

## 11. Spec del nuevo parser tabular

### 11.1 Contrato de entrada

El PDF real (`daily_workload_01Aug20260813_revision_3.pdf`) exporta texto con columnas delimitadas por espacios/tabulaciones, no por separadores de párrafo. El text layer de pdf.js entrega las celdas como tokens en la misma línea.

Columna esperada (izquierda → derecha):
```
Tipo  |  Código  |  A/C  |  Prioridad  |  Descripción  |  Realizado
```

### 11.2 Reglas del parser nuevo

1. **Detectar cabecera:** una línea que contiene las palabras `Tipo`, `Código` (o `Codigo`), `A/C` y `Prioridad` en ese orden → marcar inicio de tabla; todo antes → ignorar.
2. **Parsear fila:** tokenizar por columnas. Campos fijos a extraer:
   - `tipo_tarea`: primer token (o columna 0)
   - `codigo`: columna 1; normalizar `/` → `-`; si vacío → saltar fila
   - `matricula_avion`: columna A/C; normalizar como en `normalizeRegistration`
   - `prioridad`: columna Prioridad; mapear a `NO_GO | CRITICAL | GO_IF | NORMAL`
   - `descripcion`: columna Descripción (puede tener varios tokens/espacios)
   - `estado`: columna Realizado; `1` si contiene `✓`, `X`, `S`, `SI`, `YES`, `1`; `0` en otro caso
3. **Página de notas:** el PDF real tiene segunda página con notas generales. El nuevo parser debe:
   - Detectar el fin de tabla (línea de "Notas" o "Observaciones" o línea en blanco tras ≥3 filas válidas seguida de texto sin código)
   - **No generar tareas** a partir de texto post-tabla
4. **Compatibilidad:** mantener `PlannerParseResult` como tipo de retorno (sin cambio de contrato).
5. **Fallback:** si no se detecta cabecera de tabla, ejecutar `parsePlannerText` actual (línea-a-línea) para documentos legacy.

### 11.3 Signature recomendada

```typescript
// Nueva función — añadir a planner-parse.ts
export function parsePlannerTable(text: string): PlannerParseResult

// Lógica en parsePlannerPdf (planner-action/index.ts):
// 1. parsePlannerTable(text)  → si tasks > 0, usar
// 2. parsePlannerText(text)   → fallback legacy
// 3. openAiJson               → fallback AI
```

Sin cambiar el tipo `PlannerParseResult` ni la interfaz HTTP del endpoint.

### 11.4 Casos de test mínimos para el nuevo parser

Todos deben ejecutarse con `deno run supabase/functions/_shared/planner-parse.ts` (self-check extendido) o como fixture en `smoke.ts`:

| Caso | Input | Expect |
|------|-------|--------|
| Tabla básica 3 tareas | Header + 3 filas válidas | `tasks.length === 3` |
| Realizado=✓ | Fila con columna Realizado marcada | `estado === 1` |
| Realizado vacío | Fila sin marca | `estado === 0` |
| Página notas excluida | Tabla + separador + texto notas | Tareas solo de tabla, 0 de notas |
| Código sin separador | `MEL 2201` sin guión | Detectado o silenciosamente saltado (documentar) |
| Matrícula columna A/C | A/C=`EC-NFP` en columna | `matriculaAvion === "ECNFP"` |
| Sin cabecera (legacy) | Líneas `MEL-2201 NO GO ...` | Fallback a `parsePlannerText`, mismo resultado |
| PDF XLSX rechazado | Bytes `PK\x03\x04` (zip/xlsx) | Error 400 `not a PDF file` (ya cubierto por `assertPdf`) |

### 11.5 Qué hacer con el XLSX

Dos opciones (decisión pendiente):

| Opción | Coste | Cuando usar |
|--------|-------|-------------|
| A. Procesar en front: leer XLSX con `SheetJS` → convertir a PDF-like text → enviar como text/plain al endpoint | Nueva dep frontend, lógica en front | Si el XLSX es sencillo y se quiere evitar un nuevo endpoint |
| B. Endpoint `planner-action` acepta XLSX (content-type check + parser Deno) | Nueva dep Deno (`xlsx` o `@std/csv` si TSV) | Si el formato XLSX es la fuente canónica |

**Recomendación ponytail:** no implementar hasta tener el PDF tabular funcionando. El XLSX puede exportarse como PDF si no hay urgencia.

---

## 12. Config relevante

| Elemento | Valor |
|----------|-------|
| Supabase API port local | 55321 |
| Functions deploy list | `planner-groups`, `planner-tasks`, `planner-action`, `roster-upload`, `equipment-update` y otros |
| Remote smoke gate | `ALLOW_REMOTE_WRITE_TESTS=true` + `SUPABASE_PROJECT_REF=mjtuxabpjsgggezrsdrw` |
| PDF max size | 15 MB (`MAX_PDF_BYTES`) |
| Polling fallback | 30s (`REFRESH_MS` en useEquipment) |
| Realtime debounce | 600ms planner, 600ms roster, 600ms equipment |

---

## 13. Deuda y riesgos

| Riesgo | Severidad | Mitigación disponible |
|--------|-----------|-----------------------|
| Parser línea-a-línea falla en PDF tabular | Alta | Nuevo `parsePlannerTable` (spec §11) |
| `estado` nunca se importa desde PDF | Alta | Implementar en nuevo parser |
| Sin soporte XLSX | Media | Decisión post PDF tabular |
| `isSameCalendarDay` usa TZ browser | Baja | Pasar UTC offset desde server o normalizar a UTC en front |
| OpenAI fallback silencioso (sin key) | Media | Añadir `notice: "ai_skipped"` en respuesta |
| Working tree sin commit | — | Commit antes de implementar nuevo parser |
| Fixtures de test con PDFs reales | Media | Ver §14 |

---

## 14. Fixtures reales pendientes

Los archivos `daily_workload_01Aug20260813_revision_3.pdf` y `DAILY PRIORITY 01 AUG 26 @MADBRK (1).xlsx` **no están en el repositorio**.

Para añadirlos como fixtures de integración:

```
supabase/functions/_tests/fixtures/
  pdf.ts               ← ya existe (fixtures sintéticos)
  workload-fixture.ts  ← A CREAR: exporta makeWorkloadPdf() o loadWorkloadFixture()
```

**Opciones:**
1. **Fixture sintético** (recomendado si el PDF contiene datos operacionales reales): crear `makeWorkloadPdf(lines)` con la misma estructura de tabla, sin datos de personal reales.
2. **Archivo real en `.gitignore`**: añadir `supabase/functions/_tests/fixtures/real/` a `.gitignore`; los tests lo cargan si existe, lo saltan si no (`WORKLOAD_FIXTURE_PATH` env).

El stub del fixture debe crearse **antes** de implementar el nuevo parser, para que los tests fallen hasta que el parser los pase.

---

*Generado en fase de auditoría. No se han hecho cambios de código.*
