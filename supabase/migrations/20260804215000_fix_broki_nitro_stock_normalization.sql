-- Fix broki_normalize_nitro_stock: one canonical row per ubicacion (case-insensitive).
-- RAW (broki_legacy_rows) untouched. Unique index broki_nitro_stock_ubicacion_unique kept.
-- Forward-only; does not edit older migrations.

-- Event timestamp from nitro JSON with safe fallbacks (invalid dates → null → next key).
create or replace function public.broki_nitro_row_event_at(
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
    public.broki_jtimestamptz(p_row_data, array['updatedAt']),
    public.broki_jtimestamptz(p_row_data, array['updated_at']),
    public.broki_jtimestamptz(p_row_data, array['UPDATED_AT']),
    public.broki_jtimestamptz(p_row_data, array['fecha_modificacion']),
    public.broki_jtimestamptz(p_row_data, array['FECHA_MODIFICACION']),
    public.broki_jtimestamptz(p_row_data, array['createdAt']),
    public.broki_jtimestamptz(p_row_data, array['created_at']),
    public.broki_jtimestamptz(p_row_data, array['CREATED_AT']),
    p_synced_at,
    p_updated_at,
    p_created_at
  );
$$;

create or replace function public.broki_nitro_ubicacion_display(
  p_row_data jsonb,
  p_external_id text
)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      btrim(
        public.broki_jtxt(
          p_row_data,
          array['ubicacion', 'UBICACION', 'location', 'LOCATION']
        )
      ),
      ''
    ),
    p_external_id,
    'unknown'
  );
$$;

create or replace function public.broki_normalize_nitro_stock()
returns integer
language plpgsql
set search_path = public
as $$
declare
  n integer := 0;
begin
  -- 1) Pick one RAW row per ubicacion_key (lower(trim(display))).
  -- 2) Align / drop case-variant canonical rows so ON CONFLICT (ubicacion) works.
  -- 3) Upsert winners; skip update when existing canonical is strictly newer.

  with raw_ranked as (
    select
      r.source_system,
      r.external_id,
      r.row_data,
      r.synced_at,
      public.broki_nitro_ubicacion_display(r.row_data, r.external_id) as ubicacion_display,
      lower(public.broki_nitro_ubicacion_display(r.row_data, r.external_id)) as ubicacion_key,
      public.broki_nitro_row_event_at(
        r.row_data, r.synced_at, r.updated_at, r.created_at
      ) as event_at,
      public.broki_jint(
        r.row_data,
        array[
          'cantida_de_botellas_llenas',
          'cantidad_de_botellas_llenas',
          'botellas_llenas'
        ]
      ) as botellas_llenas,
      public.broki_jint(
        r.row_data,
        array[
          'cantidad_de_botellas_vacias',
          'cantida_de_botellas_vacias',
          'botellas_vacias'
        ]
      ) as botellas_vacias,
      row_number() over (
        partition by lower(public.broki_nitro_ubicacion_display(r.row_data, r.external_id))
        order by
          public.broki_nitro_row_event_at(
            r.row_data, r.synced_at, r.updated_at, r.created_at
          ) desc nulls last,
          r.external_id asc
      ) as row_priority
    from public.broki_legacy_rows r
    where r.source_table = 'nitro_stock'
  ),
  selected as (
    select *
    from raw_ranked
    where row_priority = 1
  ),
  -- Remove canonical rows that collide on case-insensitive ubicacion or winner external_id
  -- but are not exactly the winner ubicacion string (so INSERT can use ON CONFLICT).
  cleanup as (
    delete from public.broki_nitro_stock n
    using selected s
    where (
        lower(btrim(n.ubicacion)) = s.ubicacion_key
        and n.ubicacion is distinct from s.ubicacion_display
      )
      or (
        n.source_system = s.source_system
        and n.external_id = s.external_id
        and n.ubicacion is distinct from s.ubicacion_display
      )
    returning 1
  ),
  upserted as (
    insert into public.broki_nitro_stock (
      source_system,
      source_table,
      external_id,
      ubicacion,
      botellas_llenas,
      botellas_vacias,
      raw_payload,
      synced_at
    )
    select
      s.source_system,
      'nitro_stock',
      s.external_id,
      s.ubicacion_display,
      s.botellas_llenas,
      s.botellas_vacias,
      s.row_data,
      s.synced_at
    from selected s
    where (select count(*) from cleanup) >= 0
    on conflict (ubicacion) do update set
      source_system = excluded.source_system,
      source_table = excluded.source_table,
      external_id = excluded.external_id,
      botellas_llenas = excluded.botellas_llenas,
      botellas_vacias = excluded.botellas_vacias,
      raw_payload = excluded.raw_payload,
      synced_at = excluded.synced_at
    where
      -- Do not let an older RAW selection overwrite a newer canonical state.
      public.broki_nitro_row_event_at(
        excluded.raw_payload, excluded.synced_at, null, null
      ) is null
      or public.broki_nitro_row_event_at(
        broki_nitro_stock.raw_payload,
        broki_nitro_stock.synced_at,
        broki_nitro_stock.updated_at,
        broki_nitro_stock.created_at
      ) is null
      or public.broki_nitro_row_event_at(
        excluded.raw_payload, excluded.synced_at, null, null
      ) >= public.broki_nitro_row_event_at(
        broki_nitro_stock.raw_payload,
        broki_nitro_stock.synced_at,
        broki_nitro_stock.updated_at,
        broki_nitro_stock.created_at
      )
    returning 1
  )
  select count(*)::integer into n from upserted;

  return coalesce(n, 0);
end;
$$;

grant execute on function public.broki_nitro_row_event_at(jsonb, timestamptz, timestamptz, timestamptz)
  to service_role;
grant execute on function public.broki_nitro_ubicacion_display(jsonb, text) to service_role;
grant execute on function public.broki_normalize_nitro_stock() to service_role;

-- Canonical nitro is 1 row per ubicacion; RAW may have many. Count distinct keys.
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
    (select count(*) from broki_legacy_rows where source_table = 'tareas'),
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

-- Align migration-scoped entity audit for nitro (distinct ubicaciones).
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
      (select count(*) from mig_raw where source_table = 'tareas'),
      (select count(*) from public.broki_planner_tasks t
        where exists (select 1 from mig_raw r where r.source_table = 'tareas' and r.source_system = t.source_system and r.external_id = t.external_id))
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

-- broki_normalize_legacy_all already calls broki_normalize_nitro_stock(); no change needed.
