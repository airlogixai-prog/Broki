# BROKI — migración total con paridad V3

## Archivos

| Ruta | Rol |
|------|-----|
| `docs/private/n8n/MIGRATION_BROKI_ALL_DATA_PARITY_V3.json` | Workflow n8n importable |
| `supabase/functions/broki-import-batch/index.ts` | Edge Function de importación RAW |
| `supabase/functions/_shared/legacy-import.ts` | Helpers puros (ids, hash, unwrap) |
| `supabase/migrations/20260804204000_broki_migration_v3_audit.sql` | Batches atómicos + auditorías por `migration_id` |

## Cobertura

El inventario se obtuvo de flujos de producción WhatsApp/dashboard, HTML legacy y el contrato del repo (`legacy-field-map.json`, normalizadores, auditorías).

### Qué exporta

1. Todas las tablas físicas del esquema PostgreSQL `pro` (`relkind IN ('r','p')`).
2. Alias históricos `public.personal`, `public.furgonetas`, `public.gse`, `public.registro_comunicaciones`, `public.tool_control` si existen — identidad RAW `n8n_postgres_public` + `public__<tabla>` para no colisionar con `pro.*`.
3. Todas las filas y columnas vía `to_jsonb(t)`.
4. DataTable n8n `nitro_stock` (`brok node`, id `MRgJDLvqhpb65RI0`) con `returnAll: true`.
5. Tablas nuevas en `pro` → RAW completo + auditoría; `RAW_ONLY` si no hay normalizador.

### Garantías

- `row_data` = fila original exacta; `external_id` viaja fuera.
- Duplicados conservados con `#dup:N` (orden: hash estable → ctid).
- Tablas vacías en manifiesto (`expected_rows=0`, un batch vacío).
- Snapshots atómicos vía `broki_legacy_import_batches` + RPC `broki_complete_import_batch`.
- Auditoría RAW acotada por `migration_id` (`last_migration_id`).
- Informe de filas obsoletas: `broki_audit_obsolete_rows` (sin borrado automático).
- Auth servicio-a-servicio `X-Broki-Service-*` (sin `BROKI_ALLOW_LEGACY_IMPORT`).
- Sin secretos hardcodeados.

## Preparación

### Variables de n8n

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
BROKI_N8N_SECRET
```

### Secret de Supabase

```text
BROKI_N8N_SECRET
```

Debe coincidir con el valor de n8n. Cabeceras por batch:

```text
X-Broki-Service-Id: n8n
X-Broki-Service-Secret: $env.BROKI_N8N_SECRET
X-Broki-Request-Id: UUID v4
X-Broki-Timestamp: Unix seconds
Idempotency-Key: clave única del batch
Authorization: Bearer $env.SUPABASE_SERVICE_ROLE_KEY
apikey: $env.SUPABASE_SERVICE_ROLE_KEY
```

`verify_jwt = true` en `config.toml`. Allowlist: `FUNCTION_SERVICE_ACCESS["broki-import-batch"]` incluye `n8n` y `remote-smoke`.

## Instalación (local)

```bash
supabase db reset
deno check supabase/functions/broki-import-batch/index.ts
npm run test:integration
```

## Despliegue manual posterior

No ejecutar desde este agente en producción. Cuando staging esté listo:

```bash
supabase db push
supabase functions deploy broki-import-batch --use-api
```

## Importación manual del workflow

1. Importar `docs/private/n8n/MIGRATION_BROKI_ALL_DATA_PARITY_V3.json` en n8n.
2. Revisar credencial `Postgres account`.
3. Revisar DataTable `brok node` (`MRgJDLvqhpb65RI0`). En otra instancia n8n puede hacer falta volver a seleccionarla.
4. Confirmar variables de entorno (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BROKI_N8N_SECRET`).
5. Ejecutar primero en staging.
6. Revisar nodo `Final parity gate` (solo `{ "ok": true }` si todo cuadra).
7. No ejecutar todavía en producción.

## Orden del workflow

```text
Manual Trigger
→ Create migration context
→ Extraer PostgreSQL + Extraer nitro_stock (paralelo)
→ Construir batches
→ Unir batches
→ Importar todos los batches
→ Validar cada respuesta
→ Agregar resultados
→ Normalizar tablas conocidas
→ Auditar manifiesto de esta migración
→ Auditar snapshots
→ Auditar conteos canonical
→ Auditar raw_payload
→ Final parity gate
```

Cada ejecución genera un `migration_id` UUID v4 nuevo.

## Corte final

1. Backup completo del PostgreSQL original.
2. Detener temporalmente escrituras del dashboard y WhatsApp.
3. Ejecutar migración completa.
4. Revisar paridad (manifiesto, snapshots, canonical, `raw_payload`).
5. Pasada delta si hubo escrituras durante el proceso.
6. Confirmar cero diferencias.
7. Cambiar consumidores a Supabase.
8. Mantener PostgreSQL legacy en solo lectura un periodo de seguridad.
9. No eliminar el origen el mismo día del corte.

Tras éxito: revisar `broki_audit_obsolete_rows(migration_id)` antes de cualquier borrado/archivo explícito.

## Datos no recuperables desde PostgreSQL

El workflow no puede extraer datos solo en `localStorage` del navegador:

- `relays_db` históricos
- filtros
- tema
- modo compacto
- preferencias locales por navegador

## Tablas conocidas (normalizador)

`personal`, `inventario`, `incidencias`, `grupo_trabajo`, `tareas`, `aviones`, `tooling`, `tool_control`, `furgonetas`, `gse`, `registro_comunicaciones`, `n8n_chat_histories`, `no_existe_telefono`, `nitro_stock`.

Cualquier otra tabla descubierta queda `RAW_ONLY` tras superar auditoría RAW.
