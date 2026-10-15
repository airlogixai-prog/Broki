# Planner tasks — dedup canonical vs RAW

## Índice real

Definido en `20260620000000_broki_operational_extensions.sql`:

```sql
create unique index broki_planner_tasks_dedup_idx
on public.broki_planner_tasks (
  upper(regexp_replace(coalesce(matricula_avion, ''), '[^A-Za-z0-9]', '', 'g')),
  codigo,
  ((fecha at time zone 'UTC')::date)
)
where codigo is not null and fecha is not null;
```

Clave funcional:

1. matrícula normalizada (solo A–Z / 0–9, mayúsculas) — `EC-NTB` ≡ `ECNTB`
2. `codigo`
3. día UTC de `fecha`

Partial: solo filas con `codigo` y `fecha` no nulos.

Comprobar en staging:

```sql
select indexdef
from pg_indexes
where schemaname = 'public'
  and indexname = 'broki_planner_tasks_dedup_idx';
```

## Por qué falla la normalización antigua

`broki_normalize_planner_tasks` hacía upsert por `(source_system, external_id)`.

Varias filas RAW de `tareas` (ids legacy distintos, reimportaciones, `EC-NTB` vs `ECNTB`) comparten la misma clave de dedup → al insertar la segunda, Postgres lanza `23505` sobre `broki_planner_tasks_dedup_idx`.

Ejemplo visto en staging: `(ECNTB, 14212, 2025-12-31)`.

## Clasificación de colisiones

No son tareas “distintas” bajo la regla de negocio del índice (mismo avión + código + día). Suele ser:

- misma tarea con distinta matrícula tipográfica;
- reimportación / segunda fila legacy con otro `id`;
- versiones históricas (ganar la más reciente por `fecha_modificacion`).

RAW conserva **todas**. Canonical: **una** por clave de dedup.

## Fix

Migración: `20260804220000_fix_broki_planner_tasks_normalization.sql`

- Agrupa RAW por la misma expresión que el índice.
- Gana la más reciente (`fecha_modificacion` → … → `synced_at`).
- Desempate: `external_id`.
- Limpia canonical previos de la misma clave (otro `external_id`).
- Upsert por `(source_system, external_id)`.
- No borra RAW. No elimina el índice.

## Diagnóstico

Colisiones RAW:

```sql
select * from public.broki_audit_tareas_dedup_collisions();
```

O manual:

```sql
select
  upper(regexp_replace(coalesce(
    nullif(btrim(row_data->>'matricula_avion'), ''),
    nullif(btrim(row_data->>'matricula'), '')
  , ''), '[^A-Za-z0-9]', '', 'g')) as mat_key,
  row_data->>'codigo' as codigo,
  ((row_data->>'fecha')::timestamptz at time zone 'UTC')::date as fecha_day,
  count(*) as raw_rows,
  array_agg(external_id order by external_id) as external_ids
from public.broki_legacy_rows
where source_table = 'tareas'
  and nullif(btrim(row_data->>'codigo'), '') is not null
  and nullif(btrim(row_data->>'fecha'), '') is not null
group by 1, 2, 3
having count(*) > 1
order by raw_rows desc;
```

## Aplicar en staging

```bash
export $(grep -E '^(SUPABASE_ACCESS_TOKEN|SUPABASE_DB_PASSWORD)=' web/.env.local | xargs)
npx supabase db push
```

```sql
select public.broki_normalize_planner_tasks();
-- o
select * from public.broki_normalize_legacy_all();

select * from public.broki_normalize_legacy_validate()
where entity in ('tareas', 'nitro_stock');
```
