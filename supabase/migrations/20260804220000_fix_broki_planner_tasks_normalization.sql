-- Fix broki_normalize_planner_tasks vs broki_planner_tasks_dedup_idx.
-- RAW tareas untouched. Dedup unique index kept.
-- One canonical row per (matricula_norm, codigo, fecha::date) when both codigo+fecha present.

create or replace function public.broki_planner_task_mat_key(p_matricula text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(p_matricula, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

create or replace function public.broki_planner_task_event_at(
  p_row_data jsonb,
  p_synced_at timestamptz,
  p_updated_at timestamptz default null,
  p_created_at timestamptz default null
)
returns timestamptz
language sql
immutable
as $$
  select coalesce(
    public.broki_jtimestamptz(p_row_data, array['fecha_modificacion']),
    public.broki_jtimestamptz(p_row_data, array['FECHA_MODIFICACION']),
    public.broki_jtimestamptz(p_row_data, array['updatedAt']),
    public.broki_jtimestamptz(p_row_data, array['updated_at']),
    public.broki_jtimestamptz(p_row_data, array['fecha']),
    public.broki_jtimestamptz(p_row_data, array['FECHA']),
    p_synced_at,
    p_updated_at,
    p_created_at
  );
$$;

-- Distinct business keys for tareas RAW (aligns validate with canonical after dedup).
create or replace function public.broki_tareas_raw_distinct_count(
  p_migration_id text default null
)
returns bigint
language sql
stable
as $$
  select count(*)::bigint
  from (
    select
      case
        when public.broki_jtxt(r.row_data, array['codigo', 'CODIGO']) is not null
         and public.broki_jtimestamptz(r.row_data, array['fecha', 'FECHA']) is not null
        then
          public.broki_planner_task_mat_key(
            public.broki_jtxt(
              r.row_data,
              array['matricula_avion', 'MATRICULA_AVION', 'matricula', 'MATRICULA']
            )
          )
          || '|' || public.broki_jtxt(r.row_data, array['codigo', 'CODIGO'])
          || '|' || (
            (public.broki_jtimestamptz(r.row_data, array['fecha', 'FECHA'])
              at time zone 'UTC')::date
          )::text
        else 'id:' || r.source_system || ':' || r.external_id
      end as business_key
    from public.broki_legacy_rows r
    where r.source_table = 'tareas'
      and (p_migration_id is null or r.last_migration_id = p_migration_id)
    group by 1
  ) k;
$$;

create or replace function public.broki_normalize_planner_tasks()
returns integer
language plpgsql
set search_path = public
as $$
declare
  n integer := 0;
begin
  with raw_ranked as (
    select
      r.source_system,
      r.external_id,
      r.row_data,
      r.synced_at,
      public.broki_jbigint(r.row_data, array['id', 'ID']) as legacy_id,
      public.broki_jtxt(r.row_data, array['id_grupo_trabajo', 'ID_GRUPO_TRABAJO'])
        as grupo_trabajo_external_id,
      public.broki_jtxt(r.row_data, array['tipo_tarea', 'TIPO_TAREA']) as tipo_tarea,
      public.broki_jtxt(r.row_data, array['codigo', 'CODIGO']) as codigo,
      public.broki_jtxt(
        r.row_data,
        array['matricula_avion', 'MATRICULA_AVION', 'matricula', 'MATRICULA']
      ) as matricula_avion,
      public.broki_jtxt(r.row_data, array['prioridad', 'PRIORIDAD']) as prioridad,
      public.broki_jtxt(r.row_data, array['descripcion', 'DESCRIPCION']) as descripcion,
      public.broki_jtxt(r.row_data, array['notas', 'NOTAS']) as notas,
      public.broki_jint(r.row_data, array['estado', 'ESTADO']) as estado,
      public.broki_jtimestamptz(r.row_data, array['fecha', 'FECHA']) as fecha,
      public.broki_jtimestamptz(
        r.row_data, array['fecha_modificacion', 'FECHA_MODIFICACION']
      ) as fecha_modificacion,
      public.broki_planner_task_event_at(
        r.row_data, r.synced_at, r.updated_at, r.created_at
      ) as event_at,
      case
        when public.broki_jtxt(r.row_data, array['codigo', 'CODIGO']) is not null
         and public.broki_jtimestamptz(r.row_data, array['fecha', 'FECHA']) is not null
        then
          public.broki_planner_task_mat_key(
            public.broki_jtxt(
              r.row_data,
              array['matricula_avion', 'MATRICULA_AVION', 'matricula', 'MATRICULA']
            )
          )
          || '|' || public.broki_jtxt(r.row_data, array['codigo', 'CODIGO'])
          || '|' || (
            (public.broki_jtimestamptz(r.row_data, array['fecha', 'FECHA'])
              at time zone 'UTC')::date
          )::text
        else 'id:' || r.source_system || ':' || r.external_id
      end as business_key,
      (
        public.broki_jtxt(r.row_data, array['codigo', 'CODIGO']) is not null
        and public.broki_jtimestamptz(r.row_data, array['fecha', 'FECHA']) is not null
      ) as has_dedup
    from public.broki_legacy_rows r
    where r.source_table = 'tareas'
  ),
  ranked as (
    select
      *,
      row_number() over (
        partition by business_key
        order by event_at desc nulls last, external_id asc
      ) as row_priority
    from raw_ranked
  ),
  selected as (
    select * from ranked where row_priority = 1
  ),
  cleanup as (
    delete from public.broki_planner_tasks t
    using selected s
    where s.has_dedup
      and t.codigo is not null
      and t.fecha is not null
      and public.broki_planner_task_mat_key(t.matricula_avion)
        = public.broki_planner_task_mat_key(s.matricula_avion)
      and t.codigo = s.codigo
      and ((t.fecha at time zone 'UTC')::date)
        = ((s.fecha at time zone 'UTC')::date)
      and (t.source_system, t.external_id)
        is distinct from (s.source_system, s.external_id)
    returning 1
  ),
  upserted as (
    insert into public.broki_planner_tasks (
      source_system, source_table, external_id, legacy_id,
      grupo_trabajo_external_id,
      tipo_tarea, codigo, matricula_avion, prioridad, descripcion, notas,
      estado, fecha, fecha_modificacion, raw_payload, synced_at
    )
    select
      s.source_system,
      'pro.tareas',
      s.external_id,
      s.legacy_id,
      s.grupo_trabajo_external_id,
      s.tipo_tarea,
      s.codigo,
      s.matricula_avion,
      s.prioridad,
      s.descripcion,
      s.notas,
      s.estado,
      s.fecha,
      s.fecha_modificacion,
      s.row_data,
      s.synced_at
    from selected s
    where (select count(*) from cleanup) >= 0
    on conflict (source_system, external_id) do update set
      legacy_id = excluded.legacy_id,
      grupo_trabajo_external_id = excluded.grupo_trabajo_external_id,
      tipo_tarea = excluded.tipo_tarea,
      codigo = excluded.codigo,
      matricula_avion = excluded.matricula_avion,
      prioridad = excluded.prioridad,
      descripcion = excluded.descripcion,
      notas = excluded.notas,
      estado = excluded.estado,
      fecha = excluded.fecha,
      fecha_modificacion = excluded.fecha_modificacion,
      raw_payload = excluded.raw_payload,
      synced_at = excluded.synced_at
    where
      public.broki_planner_task_event_at(
        excluded.raw_payload, excluded.synced_at, null, null
      ) is null
      or public.broki_planner_task_event_at(
        broki_planner_tasks.raw_payload,
        broki_planner_tasks.synced_at,
        broki_planner_tasks.updated_at,
        broki_planner_tasks.created_at
      ) is null
      or public.broki_planner_task_event_at(
        excluded.raw_payload, excluded.synced_at, null, null
      ) >= public.broki_planner_task_event_at(
        broki_planner_tasks.raw_payload,
        broki_planner_tasks.synced_at,
        broki_planner_tasks.updated_at,
        broki_planner_tasks.created_at
      )
    returning 1
  )
  select count(*)::integer into n from upserted;

  return coalesce(n, 0);
end;
$$;

grant execute on function public.broki_planner_task_mat_key(text) to service_role;
grant execute on function public.broki_planner_task_event_at(jsonb, timestamptz, timestamptz, timestamptz)
  to service_role;
grant execute on function public.broki_tareas_raw_distinct_count(text) to service_role;
grant execute on function public.broki_normalize_planner_tasks() to service_role;

-- Validate: tareas RAW counted by distinct business key (not raw row count).
create or replace function public.broki_normalize_legacy_validate()
returns table(entity text, raw_count bigint, canonical_count bigint)
language sql
stable
as $$
  select 'personal',
    (select count(*) from broki_legacy_rows where source_table = 'personal'),
    (select count(*) from broki_personnel)
  union all
  select 'aviones',
    (select count(*) from broki_legacy_rows where source_table = 'aviones'),
    (select count(*) from broki_aircraft)
  union all
  select 'inventario+furgonetas+gse',
    (select count(*) from broki_legacy_rows where source_table in ('inventario', 'furgonetas', 'gse')),
    (select count(*) from broki_assets)
  union all
  select 'incidencias',
    (select count(*) from broki_legacy_rows where source_table = 'incidencias'),
    (select count(*) from broki_incidents)
  union all
  select 'grupo_trabajo',
    (select count(*) from broki_legacy_rows where source_table = 'grupo_trabajo'),
    (select count(*) from broki_planner_groups)
  union all
  select 'tareas',
    public.broki_tareas_raw_distinct_count(null),
    (select count(*) from broki_planner_tasks)
  union all
  select 'tooling',
    (select count(*) from broki_legacy_rows where source_table = 'tooling'),
    (select count(*) from broki_tooling_catalog)
  union all
  select 'tool_control',
    (select count(*) from broki_legacy_rows where source_table = 'tool_control'),
    (select count(*) from broki_tooling_movements)
  union all
  select 'registro_comunicaciones',
    (select count(*) from broki_legacy_rows where source_table = 'registro_comunicaciones'),
    (select count(*) from broki_communications)
  union all
  select 'n8n_chat_histories',
    (select count(*) from broki_legacy_rows where source_table = 'n8n_chat_histories'),
    (select count(*) from broki_chat_histories)
  union all
  select 'no_existe_telefono',
    (select count(*) from broki_legacy_rows where source_table = 'no_existe_telefono'),
    (select count(*) from broki_unknown_contacts)
  union all
  select 'nitro_stock',
    (
      select count(distinct lower(public.broki_nitro_ubicacion_display(r.row_data, r.external_id)))
      from public.broki_legacy_rows r
      where r.source_table = 'nitro_stock'
    ),
    (select count(*) from broki_nitro_stock);
$$;

grant execute on function public.broki_normalize_legacy_validate() to service_role;

-- Migration-scoped entity audit: tareas by distinct business key.
create or replace function public.broki_audit_entity_counts(p_migration_id text)
returns table(
  entity text,
  raw_count bigint,
  canonical_count bigint,
  delta bigint,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  with mig_raw as (
    select r.*
    from public.broki_legacy_rows r
    where r.last_migration_id = p_migration_id
  ),
  entity_audit as (
    select
      'personal'::text as entity,
      (select count(*) from mig_raw where source_table = 'personal')::bigint as raw_count,
      (
        select count(*) from public.broki_personnel p
        where exists (
          select 1 from mig_raw r
          where r.source_table = 'personal'
            and r.source_system = p.source_system
            and r.external_id = p.external_id
        )
      )::bigint as canonical_count
    union all
    select 'aviones',
      (select count(*) from mig_raw where source_table = 'aviones'),
      (select count(*) from public.broki_aircraft a
        where exists (select 1 from mig_raw r where r.source_table = 'aviones' and r.source_system = a.source_system and r.external_id = a.external_id))
    union all
    select 'inventario+furgonetas+gse',
      (select count(*) from mig_raw where source_table in ('inventario','furgonetas','gse')),
      (select count(*) from public.broki_assets a
        where exists (
          select 1 from mig_raw r
          where r.source_table in ('inventario','furgonetas','gse')
            and r.source_system = a.source_system
            and r.external_id = a.external_id
        ))
    union all
    select 'incidencias',
      (select count(*) from mig_raw where source_table = 'incidencias'),
      (select count(*) from public.broki_incidents i
        where exists (select 1 from mig_raw r where r.source_table = 'incidencias' and r.source_system = i.source_system and r.external_id = i.external_id))
    union all
    select 'grupo_trabajo',
      (select count(*) from mig_raw where source_table = 'grupo_trabajo'),
      (select count(*) from public.broki_planner_groups g
        where exists (select 1 from mig_raw r where r.source_table = 'grupo_trabajo' and r.source_system = g.source_system and r.external_id = g.external_id))
    union all
    select 'tareas',
      public.broki_tareas_raw_distinct_count(p_migration_id),
      (select count(*) from public.broki_planner_tasks t
        where exists (
          select 1 from mig_raw r
          where r.source_table = 'tareas'
            and r.source_system = t.source_system
            and r.external_id = t.external_id
        ))
    union all
    select 'tooling',
      (select count(*) from mig_raw where source_table = 'tooling'),
      (select count(*) from public.broki_tooling_catalog tc
        where exists (select 1 from mig_raw r where r.source_table = 'tooling' and r.source_system = tc.source_system and r.external_id = tc.external_id))
    union all
    select 'tool_control',
      (select count(*) from mig_raw where source_table = 'tool_control'),
      (select count(*) from public.broki_tooling_movements tm
        where exists (select 1 from mig_raw r where r.source_table = 'tool_control' and r.source_system = tm.source_system and r.external_id = tm.external_id))
    union all
    select 'registro_comunicaciones',
      (select count(*) from mig_raw where source_table = 'registro_comunicaciones'),
      (select count(*) from public.broki_communications c
        where exists (select 1 from mig_raw r where r.source_table = 'registro_comunicaciones' and r.source_system = c.source_system and r.external_id = c.external_id))
    union all
    select 'n8n_chat_histories',
      (select count(*) from mig_raw where source_table = 'n8n_chat_histories'),
      (select count(*) from public.broki_chat_histories ch
        where exists (select 1 from mig_raw r where r.source_table = 'n8n_chat_histories' and r.source_system = ch.source_system and r.external_id = ch.external_id))
    union all
    select 'no_existe_telefono',
      (select count(*) from mig_raw where source_table = 'no_existe_telefono'),
      (select count(*) from public.broki_unknown_contacts u
        where exists (select 1 from mig_raw r where r.source_table = 'no_existe_telefono' and r.source_system = u.source_system and r.external_id = u.external_id))
    union all
    select 'nitro_stock',
      (
        select count(distinct lower(public.broki_nitro_ubicacion_display(r.row_data, r.external_id)))
        from mig_raw r
        where r.source_table = 'nitro_stock'
      ),
      (
        select count(*) from public.broki_nitro_stock n
        where exists (
          select 1 from mig_raw r
          where r.source_table = 'nitro_stock'
            and lower(public.broki_nitro_ubicacion_display(r.row_data, r.external_id))
              = lower(btrim(n.ubicacion))
        )
      )
  ),
  known_tables as (
    select unnest(array[
      'personal','aviones','inventario','furgonetas','gse','incidencias',
      'grupo_trabajo','tareas','tooling','tool_control','registro_comunicaciones',
      'n8n_chat_histories','no_existe_telefono','nitro_stock'
    ]) as source_table
  ),
  raw_only as (
    select
      ('raw_only:' || r.source_table)::text as entity,
      count(*)::bigint as raw_count,
      0::bigint as canonical_count
    from mig_raw r
    where r.source_table not in (select source_table from known_tables)
    group by r.source_table
  )
  select * from (
    select
      e.entity,
      e.raw_count,
      e.canonical_count,
      e.raw_count - e.canonical_count as delta,
      case
        when e.raw_count = 0 and e.canonical_count = 0 then 'EMPTY'
        when e.raw_count = e.canonical_count then 'OK'
        else 'MISMATCH'
      end as status
    from entity_audit e
    union all
    select
      r.entity,
      r.raw_count,
      r.canonical_count,
      r.raw_count - r.canonical_count as delta,
      'RAW_ONLY'::text as status
    from raw_only r
  ) audit_rows
  order by audit_rows.entity;
$$;

grant execute on function public.broki_audit_entity_counts(text) to service_role;

-- Diagnostic: RAW collisions against the same dedup key (read-only).
create or replace function public.broki_audit_tareas_dedup_collisions()
returns table(
  mat_key text,
  codigo text,
  fecha_day date,
  raw_rows bigint,
  external_ids text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    public.broki_planner_task_mat_key(
      public.broki_jtxt(
        r.row_data,
        array['matricula_avion', 'MATRICULA_AVION', 'matricula', 'MATRICULA']
      )
    ) as mat_key,
    public.broki_jtxt(r.row_data, array['codigo', 'CODIGO']) as codigo,
    (
      public.broki_jtimestamptz(r.row_data, array['fecha', 'FECHA'])
      at time zone 'UTC'
    )::date as fecha_day,
    count(*)::bigint as raw_rows,
    array_agg(r.external_id order by r.external_id) as external_ids
  from public.broki_legacy_rows r
  where r.source_table = 'tareas'
    and public.broki_jtxt(r.row_data, array['codigo', 'CODIGO']) is not null
    and public.broki_jtimestamptz(r.row_data, array['fecha', 'FECHA']) is not null
  group by 1, 2, 3
  having count(*) > 1
  order by raw_rows desc, mat_key, codigo, fecha_day;
$$;

grant execute on function public.broki_audit_tareas_dedup_collisions() to service_role;
