-- BROKI migration V3 — atomic batches, migration-scoped audit, obsolete report.
-- Forward-only. Does not rewrite or delete existing broki_legacy_rows.

-- ---------------------------------------------------------------------------
-- Track which migration last touched each raw row
-- ---------------------------------------------------------------------------

alter table public.broki_legacy_rows
  add column if not exists last_migration_id text;

create index if not exists broki_legacy_rows_last_migration_idx
  on public.broki_legacy_rows (last_migration_id);

create index if not exists broki_legacy_rows_migration_table_idx
  on public.broki_legacy_rows (last_migration_id, source_system, source_table);

-- ---------------------------------------------------------------------------
-- One snapshot per (migration, system, schema, table)
-- ---------------------------------------------------------------------------

create unique index if not exists broki_legacy_snapshots_migration_table_uidx
  on public.broki_legacy_table_snapshots (
    (metadata->>'migration_id'),
    source_system,
    (coalesce(source_schema, '')),
    source_table
  )
  where (metadata->>'migration_id') is not null;

-- ---------------------------------------------------------------------------
-- Per-batch ledger (atomic snapshot completion)
-- ---------------------------------------------------------------------------

create table if not exists public.broki_legacy_import_batches (
  id uuid primary key default gen_random_uuid(),
  migration_id text not null,
  snapshot_id uuid not null references public.broki_legacy_table_snapshots(id) on delete cascade,
  source_system text not null,
  source_schema text,
  source_table text not null,
  batch_index integer not null check (batch_index >= 0),
  total_batches integer not null check (total_batches >= 1),
  expected_rows integer not null check (expected_rows >= 0),
  received_rows integer not null default 0 check (received_rows >= 0),
  imported_rows integer not null default 0 check (imported_rows >= 0),
  failed_rows integer not null default 0 check (failed_rows >= 0),
  status text not null default 'success'
    check (status in ('success', 'partial', 'failed')),
  batch_hash text not null,
  created_at timestamptz not null default now(),
  finished_at timestamptz not null default now(),
  constraint broki_legacy_import_batches_uidx
    unique nulls not distinct (
      migration_id, source_system, source_schema, source_table, batch_index
    )
);

create index if not exists broki_legacy_import_batches_snapshot_idx
  on public.broki_legacy_import_batches (snapshot_id);

alter table public.broki_legacy_import_batches enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'broki_legacy_import_batches'
      and policyname = 'Authenticated users can read'
  ) then
    create policy "Authenticated users can read"
      on public.broki_legacy_import_batches
      for select to authenticated
      using (true);
  end if;
end;
$$;

grant all on table public.broki_legacy_import_batches to service_role;

-- ---------------------------------------------------------------------------
-- Atomic batch completion + snapshot rollup
-- ---------------------------------------------------------------------------

create or replace function public.broki_complete_import_batch(
  p_migration_id text,
  p_source_system text,
  p_source_schema text,
  p_source_table text,
  p_batch_index integer,
  p_total_batches integer,
  p_total_rows integer,
  p_received_rows integer,
  p_imported_rows integer,
  p_failed_rows integer,
  p_batch_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snapshot_id uuid;
  v_existing public.broki_legacy_import_batches%rowtype;
  v_imported integer;
  v_failed integer;
  v_received integer;
  v_batch_count integer;
  v_missing integer;
  v_status text;
  v_replay boolean := false;
begin
  if p_migration_id is null or length(trim(p_migration_id)) = 0 then
    raise exception 'invalid_migration_id';
  end if;
  if p_source_system is null or p_source_table is null then
    raise exception 'invalid_source';
  end if;
  if p_batch_index is null or p_total_batches is null
     or p_batch_index < 0 or p_total_batches < 1
     or p_batch_index >= p_total_batches then
    raise exception 'invalid_batch_index';
  end if;
  if p_batch_hash is null or length(p_batch_hash) = 0 then
    raise exception 'invalid_batch_hash';
  end if;

  select s.id
    into v_snapshot_id
  from public.broki_legacy_table_snapshots s
  where s.metadata->>'migration_id' = p_migration_id
    and s.source_system = p_source_system
    and s.source_table = p_source_table
    and s.source_schema is not distinct from p_source_schema
  order by s.started_at desc
  limit 1
  for update;

  if v_snapshot_id is null then
    begin
      insert into public.broki_legacy_table_snapshots (
        source_system,
        source_schema,
        source_table,
        total_rows,
        status,
        metadata
      ) values (
        p_source_system,
        p_source_schema,
        p_source_table,
        p_total_rows,
        'running',
        jsonb_build_object(
          'migration_id', p_migration_id,
          'total_batches', p_total_batches,
          'importer_version', 'v3'
        )
      )
      returning id into v_snapshot_id;
    exception
      when unique_violation then
        select s.id
          into v_snapshot_id
        from public.broki_legacy_table_snapshots s
        where s.metadata->>'migration_id' = p_migration_id
          and s.source_system = p_source_system
          and s.source_table = p_source_table
          and s.source_schema is not distinct from p_source_schema
        order by s.started_at desc
        limit 1
        for update;
    end;
  end if;

  select *
    into v_existing
  from public.broki_legacy_import_batches b
  where b.migration_id = p_migration_id
    and b.source_system = p_source_system
    and b.source_table = p_source_table
    and b.source_schema is not distinct from p_source_schema
    and b.batch_index = p_batch_index
  for update;

  if found then
    if v_existing.batch_hash is distinct from p_batch_hash then
      raise exception 'batch_content_mismatch';
    end if;
    v_replay := true;
  else
    begin
      insert into public.broki_legacy_import_batches (
        migration_id,
        snapshot_id,
        source_system,
        source_schema,
        source_table,
        batch_index,
        total_batches,
        expected_rows,
        received_rows,
        imported_rows,
        failed_rows,
        status,
        batch_hash
      ) values (
        p_migration_id,
        v_snapshot_id,
        p_source_system,
        p_source_schema,
        p_source_table,
        p_batch_index,
        p_total_batches,
        p_total_rows,
        coalesce(p_received_rows, 0),
        coalesce(p_imported_rows, 0),
        coalesce(p_failed_rows, 0),
        case
          when coalesce(p_failed_rows, 0) = 0 then 'success'
          when coalesce(p_imported_rows, 0) > 0 then 'partial'
          else 'failed'
        end,
        p_batch_hash
      );
    exception
      when unique_violation then
        select *
          into v_existing
        from public.broki_legacy_import_batches b
        where b.migration_id = p_migration_id
          and b.source_system = p_source_system
          and b.source_table = p_source_table
          and b.source_schema is not distinct from p_source_schema
          and b.batch_index = p_batch_index;
        if v_existing.batch_hash is distinct from p_batch_hash then
          raise exception 'batch_content_mismatch';
        end if;
        v_replay := true;
    end;
  end if;

  select
    coalesce(sum(b.imported_rows), 0)::integer,
    coalesce(sum(b.failed_rows), 0)::integer,
    coalesce(sum(b.received_rows), 0)::integer,
    count(*)::integer
  into v_imported, v_failed, v_received, v_batch_count
  from public.broki_legacy_import_batches b
  where b.migration_id = p_migration_id
    and b.source_system = p_source_system
    and b.source_table = p_source_table
    and b.source_schema is not distinct from p_source_schema;

  select count(*)::integer
    into v_missing
  from generate_series(0, p_total_batches - 1) as g(i)
  where not exists (
    select 1
    from public.broki_legacy_import_batches b
    where b.migration_id = p_migration_id
      and b.source_system = p_source_system
      and b.source_table = p_source_table
      and b.source_schema is not distinct from p_source_schema
      and b.batch_index = g.i
  );

  if v_missing = 0 and v_failed = 0 and v_imported = p_total_rows then
    v_status := 'success';
  elsif v_missing = 0 and v_failed > 0 then
    v_status := case when v_imported > 0 then 'partial' else 'failed' end;
  elsif v_missing = 0 and v_imported <> p_total_rows then
    v_status := 'partial';
  else
    v_status := 'running';
  end if;

  update public.broki_legacy_table_snapshots
  set
    total_rows = p_total_rows,
    imported_rows = v_imported,
    failed_rows = v_failed,
    status = v_status,
    finished_at = case when v_status = 'running' then null else now() end,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'migration_id', p_migration_id,
      'total_batches', p_total_batches,
      'received_rows', v_received,
      'batch_count', v_batch_count,
      'importer_version', 'v3'
    )
  where id = v_snapshot_id;

  return jsonb_build_object(
    'snapshot_id', v_snapshot_id,
    'snapshot_status', v_status,
    'snapshot_imported_rows', v_imported,
    'snapshot_failed_rows', v_failed,
    'replay', v_replay,
    'batches_recorded', v_batch_count,
    'batches_missing', v_missing
  );
end;
$$;

grant execute on function public.broki_complete_import_batch(
  text, text, text, text, integer, integer, integer, integer, integer, integer, text
) to service_role;

-- ---------------------------------------------------------------------------
-- Manifest audit scoped to one migration_id
-- ---------------------------------------------------------------------------

drop function if exists public.broki_audit_source_manifest(jsonb);

create or replace function public.broki_audit_source_manifest(
  p_migration_id text,
  p_manifest jsonb
)
returns table(
  source_system text,
  source_schema text,
  source_table text,
  expected_rows bigint,
  raw_rows bigint,
  delta bigint,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  with manifest as (
    select
      m.source_system,
      m.source_schema,
      m.source_table,
      m.expected_rows
    from jsonb_to_recordset(coalesce(p_manifest, '[]'::jsonb)) as m(
      source_system text,
      source_schema text,
      source_table text,
      expected_rows bigint
    )
  ), raw_counts as (
    select
      r.source_system,
      r.source_schema,
      r.source_table,
      count(*)::bigint as raw_rows
    from public.broki_legacy_rows r
    where r.last_migration_id = p_migration_id
    group by r.source_system, r.source_schema, r.source_table
  )
  select
    m.source_system,
    m.source_schema,
    m.source_table,
    m.expected_rows,
    coalesce(r.raw_rows, 0)::bigint as raw_rows,
    (m.expected_rows - coalesce(r.raw_rows, 0))::bigint as delta,
    case
      when m.expected_rows = coalesce(r.raw_rows, 0) then 'OK'
      else 'MISMATCH'
    end as status
  from manifest m
  left join raw_counts r
    on r.source_system = m.source_system
   and r.source_table = m.source_table
   and r.source_schema is not distinct from m.source_schema
  order by m.source_system, m.source_schema, m.source_table;
$$;

grant execute on function public.broki_audit_source_manifest(text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Snapshot audit for one migration
-- ---------------------------------------------------------------------------

create or replace function public.broki_audit_migration_snapshots(p_migration_id text)
returns table(
  source_system text,
  source_schema text,
  source_table text,
  total_rows integer,
  imported_rows integer,
  failed_rows integer,
  delta integer,
  status text,
  started_at timestamptz,
  finished_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.source_system,
    s.source_schema,
    s.source_table,
    coalesce(s.total_rows, 0) as total_rows,
    s.imported_rows,
    s.failed_rows,
    coalesce(s.total_rows, 0) - s.imported_rows as delta,
    s.status,
    s.started_at,
    s.finished_at
  from public.broki_legacy_table_snapshots s
  where s.metadata->>'migration_id' = p_migration_id
  order by s.source_system, s.source_schema, s.source_table;
$$;

grant execute on function public.broki_audit_migration_snapshots(text) to service_role;

-- ---------------------------------------------------------------------------
-- Obsolete rows: present in RAW but not seen by this migration
-- ---------------------------------------------------------------------------

create or replace function public.broki_audit_obsolete_rows(p_migration_id text)
returns table(
  source_system text,
  source_schema text,
  source_table text,
  external_id text,
  last_migration_id text,
  synced_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.source_system,
    r.source_schema,
    r.source_table,
    r.external_id,
    r.last_migration_id,
    r.synced_at
  from public.broki_legacy_rows r
  where r.last_migration_id is distinct from p_migration_id
    and exists (
      select 1
      from public.broki_legacy_rows cur
      where cur.last_migration_id = p_migration_id
        and cur.source_system = r.source_system
        and cur.source_table = r.source_table
        and cur.source_schema is not distinct from r.source_schema
    )
  order by r.source_system, r.source_schema, r.source_table, r.external_id;
$$;

grant execute on function public.broki_audit_obsolete_rows(text) to service_role;

-- ---------------------------------------------------------------------------
-- Entity counts scoped to one migration (known + RAW_ONLY unknowns)
-- ---------------------------------------------------------------------------

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
      (select count(*) from mig_raw where source_table = 'nitro_stock'),
      (select count(*) from public.broki_nitro_stock n
        where exists (select 1 from mig_raw r where r.source_table = 'nitro_stock' and r.source_system = n.source_system and r.external_id = n.external_id))
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

-- Keep zero-arg overload for pre-V3 callers / dashboards.
create or replace function public.broki_audit_entity_counts()
returns table(
  entity text,
  raw_count bigint,
  canonical_count bigint,
  delta bigint,
  status text
)
language sql
stable
as $$
  select
    v.entity,
    v.raw_count,
    v.canonical_count,
    v.raw_count - v.canonical_count as delta,
    case
      when v.raw_count = 0 and v.canonical_count = 0 then 'EMPTY'
      when v.raw_count = v.canonical_count then 'OK'
      else 'MISMATCH'
    end as status
  from public.broki_normalize_legacy_validate() v;
$$;

grant execute on function public.broki_audit_entity_counts() to service_role;
