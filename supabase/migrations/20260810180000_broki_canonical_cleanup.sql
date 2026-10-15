-- Fase 11: canonical cleanup (assets merge, planner zombies, tooling smoke/links).
-- Does NOT mutate broki_legacy_rows.
-- dry_run default true. Audit + ID backup in broki_canonical_cleanup_audit.
-- Rollback: restore deleted rows from audit.backup jsonb (documented in 15-report).

create table if not exists public.broki_canonical_cleanup_audit (
  id bigserial primary key,
  run_id uuid not null,
  migration_id text not null,
  dry_run boolean not null,
  entity_type text not null,
  action text not null,
  canonical_id uuid,
  merge_into uuid,
  logical_key text,
  reason text,
  backup jsonb,
  created_at timestamptz not null default now()
);

create index if not exists broki_canonical_cleanup_audit_run_idx
  on public.broki_canonical_cleanup_audit (run_id);

create or replace function public.broki_asset_logical_key(
  p_identifier text,
  p_external_id text
)
returns text
language sql
immutable
as $$
  select case
    when p_identifier ~ '[A-Za-z-]' and p_identifier !~ '^\d+$'
      then upper(trim(p_identifier))
    when p_external_id ~ '[A-Za-z-]' and p_external_id !~ '^\d+$'
      then upper(trim(p_external_id))
    else upper(trim(coalesce(nullif(p_identifier, ''), p_external_id, '')))
  end;
$$;

create or replace function public.broki_canonical_cleanup(
  p_migration_id text,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run uuid := gen_random_uuid();
  v_mid text := trim(p_migration_id);
  r record;
  v_keeper uuid;
  v_kind_rank int;
  v_best_rank int;
  v_assets_keep int := 0;
  v_assets_merge int := 0;
  v_assets_deleted int := 0;
  v_groups_deleted int := 0;
  v_tasks_deleted int := 0;
  v_moves_deleted int := 0;
  v_moves_rebuilt int := 0;
  v_aliases int := 0;
  v_fk_repoints int := 0;
  v_open_dup_closed int := 0;
begin
  if v_mid is null or length(v_mid) = 0 then
    raise exception 'p_migration_id_required';
  end if;

  -- Snapshot before counts into one audit row
  insert into public.broki_canonical_cleanup_audit (
    run_id, migration_id, dry_run, entity_type, action, reason, backup
  ) values (
    v_run, v_mid, p_dry_run, 'metrics', 'BEFORE', 'snapshot',
    jsonb_build_object(
      'assets', (select count(*) from public.broki_assets),
      'personnel', (select count(*) from public.broki_personnel),
      'planner_groups', (select count(*) from public.broki_planner_groups),
      'planner_tasks', (select count(*) from public.broki_planner_tasks),
      'tooling_movements', (select count(*) from public.broki_tooling_movements),
      'legacy_rows', (select count(*) from public.broki_legacy_rows)
    )
  );

  ------------------------------------------------------------------
  -- ASSETS: build merge map (logical_key → keeper)
  ------------------------------------------------------------------
  create temporary table _cc_assets on commit drop as
  select
    a.id,
    a.identifier,
    a.external_id,
    a.source_table,
    a.asset_kind,
    public.broki_asset_logical_key(a.identifier, a.external_id) as logical_key,
    (
      select r.last_migration_id
      from public.broki_legacy_rows r
      where r.source_system = a.source_system
        and r.source_table = replace(a.source_table, 'pro.', '')
        and r.external_id = a.external_id
      limit 1
    ) as mid,
    case a.asset_kind
      when 'van' then 3
      when 'gse' then 2
      when 'inventory' then 1
      else 0
    end as kind_rank,
    a.estado, a.parking, a.avion_text, a.current_worker_text, a.current_worker_id,
    a.combustible, a.adblue, a.nitrogeno_1, a.nitrogeno_2, a.nitrogeno_3, a.nitrogeno_4,
    a.notas, a.descripcion, a.nombre_equipo, a.matricula, a.familia, a.plazas,
    a.ubicacion_habitual, a.raw_payload, a.legacy_id
  from public.broki_assets a
  where coalesce(public.broki_asset_logical_key(a.identifier, a.external_id), '') <> '';

  create temporary table _cc_keepers on commit drop as
  select distinct on (logical_key)
    logical_key,
    id as keeper_id,
    mid,
    kind_rank,
    asset_kind
  from _cc_assets
  order by
    logical_key,
    case when mid = v_mid then 1 else 0 end desc,
    kind_rank desc,
    id;

  select count(*)::int into v_assets_keep from _cc_keepers;

  create temporary table _cc_donors on commit drop as
  select a.*, k.keeper_id
  from _cc_assets a
  join _cc_keepers k on k.logical_key = a.logical_key
  where a.id <> k.keeper_id;

  select count(*)::int into v_assets_merge from _cc_donors;

  for r in select * from _cc_donors
  loop
    insert into public.broki_canonical_cleanup_audit (
      run_id, migration_id, dry_run, entity_type, action, canonical_id, merge_into,
      logical_key, reason, backup
    )
    select
      v_run, v_mid, p_dry_run, 'asset', 'MERGE', r.id, r.keeper_id, r.logical_key,
      case
        when r.mid = v_mid and r.asset_kind = 'inventory' then 'cross_source_inventory_vs_operational'
        else 'external_id_scheme_zombie'
      end,
      to_jsonb(a)
    from public.broki_assets a where a.id = r.id;
  end loop;

  for r in select * from _cc_keepers
  loop
    insert into public.broki_canonical_cleanup_audit (
      run_id, migration_id, dry_run, entity_type, action, canonical_id,
      logical_key, reason
    ) values (
      v_run, v_mid, p_dry_run, 'asset', 'KEEP', r.keeper_id, r.logical_key, 'logical_keeper'
    );
  end loop;

  if not p_dry_run then
    -- Enrich keeper with donor non-nulls (keeper wins when both set)
    for r in select * from _cc_donors
    loop
      update public.broki_assets k
      set
        estado = coalesce(k.estado, r.estado),
        parking = coalesce(k.parking, r.parking),
        avion_text = coalesce(k.avion_text, r.avion_text),
        current_worker_text = coalesce(k.current_worker_text, r.current_worker_text),
        current_worker_id = coalesce(k.current_worker_id, r.current_worker_id),
        combustible = coalesce(k.combustible, r.combustible),
        adblue = coalesce(k.adblue, r.adblue),
        nitrogeno_1 = coalesce(k.nitrogeno_1, r.nitrogeno_1),
        nitrogeno_2 = coalesce(k.nitrogeno_2, r.nitrogeno_2),
        nitrogeno_3 = coalesce(k.nitrogeno_3, r.nitrogeno_3),
        nitrogeno_4 = coalesce(k.nitrogeno_4, r.nitrogeno_4),
        notas = coalesce(k.notas, r.notas),
        descripcion = coalesce(k.descripcion, r.descripcion),
        nombre_equipo = coalesce(k.nombre_equipo, r.nombre_equipo),
        matricula = coalesce(k.matricula, r.matricula),
        familia = coalesce(k.familia, r.familia),
        plazas = coalesce(k.plazas, r.plazas),
        ubicacion_habitual = coalesce(k.ubicacion_habitual, r.ubicacion_habitual),
        identifier = coalesce(
          nullif(public.broki_asset_logical_key(k.identifier, k.external_id), ''),
          r.logical_key,
          k.identifier
        ),
        updated_at = now()
      where k.id = r.keeper_id;

      -- Reassign FKs
      update public.broki_incidents set asset_id = r.keeper_id where asset_id = r.id;
      get diagnostics v_kind_rank = row_count;
      v_fk_repoints := v_fk_repoints + v_kind_rank;

      update public.broki_planner_groups set vehicle_asset_id = r.keeper_id where vehicle_asset_id = r.id;
      get diagnostics v_kind_rank = row_count;
      v_fk_repoints := v_fk_repoints + v_kind_rank;

      update public.broki_asset_aliases set asset_id = r.keeper_id where asset_id = r.id
        and not exists (
          select 1 from public.broki_asset_aliases x
          where x.asset_id = r.keeper_id and x.alias = broki_asset_aliases.alias
        );
      delete from public.broki_asset_aliases where asset_id = r.id;

      -- Aliases for donor identity
      insert into public.broki_asset_aliases (asset_id, alias)
      values
        (r.keeper_id, r.external_id),
        (r.keeper_id, coalesce(r.identifier, r.external_id))
      on conflict do nothing;
      v_aliases := v_aliases + 1;
    end loop;

    delete from public.broki_assets a
    using _cc_donors d
    where a.id = d.id;
    get diagnostics v_assets_deleted = row_count;
  end if;

  ------------------------------------------------------------------
  -- PLANNER: orphan groups / tasks (not in V7 raw)
  ------------------------------------------------------------------
  create temporary table _cc_orphan_groups on commit drop as
  select g.id, g.external_id
  from public.broki_planner_groups g
  where not exists (
    select 1 from public.broki_legacy_rows r
    where r.source_table = 'grupo_trabajo'
      and r.last_migration_id = v_mid
      and r.external_id = g.external_id
  );

  create temporary table _cc_orphan_tasks on commit drop as
  select t.id, t.external_id, t.group_id
  from public.broki_planner_tasks t
  where not exists (
    select 1 from public.broki_legacy_rows r
    where r.source_table = 'tareas'
      and r.last_migration_id = v_mid
      and r.external_id = t.external_id
  );

  for r in select * from _cc_orphan_groups
  loop
    insert into public.broki_canonical_cleanup_audit (
      run_id, migration_id, dry_run, entity_type, action, canonical_id, reason, backup
    )
    select v_run, v_mid, p_dry_run, 'planner_group', 'DELETE_CANDIDATE', r.id, 'orphan_group_zombie', to_jsonb(g)
    from public.broki_planner_groups g where g.id = r.id;
  end loop;

  for r in select * from _cc_orphan_tasks
  loop
    insert into public.broki_canonical_cleanup_audit (
      run_id, migration_id, dry_run, entity_type, action, canonical_id, reason, backup
    )
    select v_run, v_mid, p_dry_run, 'planner_task', 'DELETE_CANDIDATE', r.id, 'orphan_task_zombie', to_jsonb(t)
    from public.broki_planner_tasks t where t.id = r.id;
  end loop;

  if not p_dry_run then
    -- Detach members of orphan groups then delete groups
    delete from public.broki_planner_group_members m
    using _cc_orphan_groups o where m.group_id = o.id;

    update public.broki_planner_tasks t
    set group_id = null
    where t.group_id in (select id from _cc_orphan_groups)
      and t.id not in (select id from _cc_orphan_tasks);

    delete from public.broki_planner_tasks t
    using _cc_orphan_tasks o where t.id = o.id;
    get diagnostics v_tasks_deleted = row_count;

    delete from public.broki_planner_groups g
    using _cc_orphan_groups o where g.id = o.id;
    get diagnostics v_groups_deleted = row_count;
  else
    select count(*)::int into v_groups_deleted from _cc_orphan_groups;
    select count(*)::int into v_tasks_deleted from _cc_orphan_tasks;
  end if;

  ------------------------------------------------------------------
  -- TOOLING: smoke delete + tool_id rebuild + one open checkout
  ------------------------------------------------------------------
  create temporary table _cc_smoke_moves on commit drop as
  select m.id
  from public.broki_tooling_movements m
  where coalesce(m.bac_bact, '') ~* 'BAC-SMK|SMOKE|E2E|remote-test'
     or coalesce(m.external_id, '') ~* 'BAC-SMK|SMOKE|E2E|remote-test'
     or coalesce(m.remarks, '') ~* 'BAC-SMK|SMOKE|E2E|remote-test';

  for r in
    select m.* from public.broki_tooling_movements m
    join _cc_smoke_moves s on s.id = m.id
  loop
    insert into public.broki_canonical_cleanup_audit (
      run_id, migration_id, dry_run, entity_type, action, canonical_id, reason, backup
    ) values (
      v_run, v_mid, p_dry_run, 'tooling_movement', 'DELETE_CANDIDATE', r.id, 'smoke', to_jsonb(r)
    );
  end loop;

  create temporary table _cc_rebuild_moves on commit drop as
  select m.id, t.id as tool_id, m.bac_bact
  from public.broki_tooling_movements m
  join public.broki_tooling_catalog t
    on upper(t.bac_bact) = upper(m.bac_bact)
  where m.tool_id is null
    and m.bac_bact is not null
    and m.id not in (select id from _cc_smoke_moves);

  for r in select * from _cc_rebuild_moves
  loop
    insert into public.broki_canonical_cleanup_audit (
      run_id, migration_id, dry_run, entity_type, action, canonical_id, merge_into, reason
    ) values (
      v_run, v_mid, p_dry_run, 'tooling_movement', 'REBUILD', r.id, r.tool_id, 'broken_relation_link_tool_id'
    );
  end loop;

  -- Duplicate open checkouts: keep newest date_out, delete rest
  create temporary table _cc_open_dup on commit drop as
  with open_m as (
    select m.*,
      row_number() over (
        partition by upper(m.bac_bact)
        order by m.date_out desc nulls last, m.id
      ) as rn
    from public.broki_tooling_movements m
    where m.date_in is null
      and m.bac_bact is not null
      and m.id not in (select id from _cc_smoke_moves)
  )
  select id from open_m where rn > 1;

  for r in
    select m.* from public.broki_tooling_movements m
    join _cc_open_dup d on d.id = m.id
  loop
    insert into public.broki_canonical_cleanup_audit (
      run_id, migration_id, dry_run, entity_type, action, canonical_id, reason, backup
    ) values (
      v_run, v_mid, p_dry_run, 'tooling_movement', 'DELETE_CANDIDATE', r.id, 'duplicate_open_checkout', to_jsonb(r)
    );
  end loop;

  if not p_dry_run then
    update public.broki_tooling_movements m
    set tool_id = r.tool_id
    from _cc_rebuild_moves r
    where m.id = r.id;
    get diagnostics v_moves_rebuilt = row_count;

    delete from public.broki_tooling_movements m
    using _cc_smoke_moves s where m.id = s.id;
    get diagnostics v_moves_deleted = row_count;

    delete from public.broki_tooling_movements m
    using _cc_open_dup d where m.id = d.id;
    get diagnostics v_open_dup_closed = row_count;
    v_moves_deleted := v_moves_deleted + v_open_dup_closed;
  else
    select count(*)::int into v_moves_deleted from _cc_smoke_moves;
    select count(*)::int into v_moves_rebuilt from _cc_rebuild_moves;
    select count(*)::int into v_open_dup_closed from _cc_open_dup;
  end if;

  insert into public.broki_canonical_cleanup_audit (
    run_id, migration_id, dry_run, entity_type, action, reason, backup
  ) values (
    v_run, v_mid, p_dry_run, 'metrics', 'AFTER', 'snapshot',
    case when p_dry_run then
      jsonb_build_object(
        'assets_expected', v_assets_keep,
        'assets_would_merge', v_assets_merge,
        'groups_would_delete', v_groups_deleted,
        'tasks_would_delete', v_tasks_deleted,
        'moves_would_delete', v_moves_deleted,
        'moves_would_rebuild', v_moves_rebuilt,
        'open_dup_would_close', v_open_dup_closed,
        'legacy_rows', (select count(*) from public.broki_legacy_rows)
      )
    else
      jsonb_build_object(
        'assets', (select count(*) from public.broki_assets),
        'personnel', (select count(*) from public.broki_personnel),
        'planner_groups', (select count(*) from public.broki_planner_groups),
        'planner_tasks', (select count(*) from public.broki_planner_tasks),
        'tooling_movements', (select count(*) from public.broki_tooling_movements),
        'legacy_rows', (select count(*) from public.broki_legacy_rows),
        'assets_deleted', v_assets_deleted,
        'fk_repoints', v_fk_repoints,
        'aliases_touched', v_aliases,
        'groups_deleted', v_groups_deleted,
        'tasks_deleted', v_tasks_deleted,
        'moves_deleted', v_moves_deleted,
        'moves_rebuilt', v_moves_rebuilt
      )
    end
  );

  return jsonb_build_object(
    'ok', true,
    'run_id', v_run,
    'dry_run', p_dry_run,
    'migration_id', v_mid,
    'assets_keep', v_assets_keep,
    'assets_merge', v_assets_merge,
    'assets_deleted', case when p_dry_run then 0 else v_assets_deleted end,
    'groups_deleted_or_planned', v_groups_deleted,
    'tasks_deleted_or_planned', v_tasks_deleted,
    'moves_deleted_or_planned', v_moves_deleted,
    'moves_rebuilt_or_planned', v_moves_rebuilt,
    'open_dup_closed_or_planned', v_open_dup_closed,
    'fk_repoints', v_fk_repoints,
    'applied', not p_dry_run
  );
end;
$$;

revoke all on function public.broki_canonical_cleanup(text, boolean) from public;
grant execute on function public.broki_canonical_cleanup(text, boolean) to service_role;

-- Prevent zombie re-creation: only rows with last_migration_id; skip inventario
-- when same logical identifier already exists as van/gse.
create or replace function public.broki_normalize_assets()
returns integer
language plpgsql
as $$
declare n integer;
begin
  insert into public.broki_assets (
    source_system, source_table, external_id, legacy_id,
    asset_kind, identifier, descripcion, nombre_equipo, matricula, familia, plazas,
    estado, ubicacion_habitual, parking, avion_text, current_worker_text,
    combustible, adblue, nitrogeno_1, nitrogeno_2, nitrogeno_3, nitrogeno_4, notas,
    raw_payload, synced_at
  )
  select
    r.source_system,
    'pro.' || r.source_table,
    r.external_id,
    public.broki_jbigint(r.row_data, array['id', 'ID']),
    case r.source_table
      when 'inventario' then 'inventory'
      when 'furgonetas' then 'van'
      when 'gse' then 'gse'
      else 'other'
    end,
    coalesce(
      public.broki_jtxt(r.row_data, array['identificador', 'IDENTIFICADOR', 'brk', 'BRK', 'id', 'ID']),
      r.external_id
    ),
    coalesce(
      public.broki_jtxt(r.row_data, array['descripcion', 'DESCRIPCION']),
      public.broki_jtxt(r.row_data, array['vehiculo', 'VEHICULO'])
    ),
    public.broki_jtxt(r.row_data, array['nombre_equipo', 'NOMBRE_EQUIPO', 'nombre', 'NOMBRE']),
    public.broki_jtxt(r.row_data, array['matricula', 'MATRICULA']),
    public.broki_jtxt(r.row_data, array['familia', 'FAMILIA']),
    public.broki_jtxt(r.row_data, array['plazas', 'PLAZAS']),
    public.broki_jtxt(r.row_data, array['estado', 'ESTADO']),
    public.broki_jtxt(r.row_data, array['ubicacion_habitual', 'UBICACION_HABITUAL']),
    public.broki_jtxt(r.row_data, array['parking', 'PARKING']),
    public.broki_jtxt(r.row_data, array['avion', 'AVION']),
    public.broki_jtxt(r.row_data, array[
      'trabajador', 'TRABAJADOR', 'trabajadores', 'TRABAJADORES'
    ]),
    public.broki_jnumeric(r.row_data, array['combustible', 'COMBUSTIBLE']),
    public.broki_jnumeric(r.row_data, array['adblue', 'ADBLUE']),
    public.broki_jnumeric(r.row_data, array['nitrogeno_1', 'NITROGENO_1']),
    public.broki_jnumeric(r.row_data, array['nitrogeno_2', 'NITROGENO_2']),
    public.broki_jnumeric(r.row_data, array['nitrogeno_3', 'NITROGENO_3']),
    public.broki_jnumeric(r.row_data, array['nitrogeno_4', 'NITROGENO_4']),
    public.broki_jtxt(r.row_data, array['notas', 'NOTAS']),
    r.row_data,
    r.synced_at
  from public.broki_legacy_rows r
  where r.source_table in ('inventario', 'furgonetas', 'gse')
    and r.last_migration_id is not null
    and not (
      r.source_table = 'inventario'
      and exists (
        select 1
        from public.broki_assets a
        where a.asset_kind in ('van', 'gse')
          and public.broki_asset_logical_key(a.identifier, a.external_id)
            = public.broki_asset_logical_key(
                coalesce(
                  public.broki_jtxt(r.row_data, array['identificador', 'IDENTIFICADOR', 'brk', 'BRK', 'id', 'ID']),
                  r.external_id
                ),
                r.external_id
              )
      )
    )
  on conflict (source_system, source_table, external_id) do update set
    legacy_id = excluded.legacy_id,
    asset_kind = excluded.asset_kind,
    identifier = excluded.identifier,
    descripcion = excluded.descripcion,
    nombre_equipo = excluded.nombre_equipo,
    matricula = excluded.matricula,
    familia = excluded.familia,
    plazas = excluded.plazas,
    estado = excluded.estado,
    ubicacion_habitual = excluded.ubicacion_habitual,
    parking = excluded.parking,
    avion_text = excluded.avion_text,
    current_worker_text = excluded.current_worker_text,
    combustible = excluded.combustible,
    adblue = excluded.adblue,
    nitrogeno_1 = excluded.nitrogeno_1,
    nitrogeno_2 = excluded.nitrogeno_2,
    nitrogeno_3 = excluded.nitrogeno_3,
    nitrogeno_4 = excluded.nitrogeno_4,
    notas = excluded.notas,
    raw_payload = excluded.raw_payload,
    synced_at = excluded.synced_at;

  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.broki_verify_canonical_cleanup(p_migration_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mid text := trim(p_migration_id);
  v_dup int;
  v_orphan_g int;
  v_orphan_t int;
  v_smoke int;
  v_broken int;
  v_open_dup int;
  v_assets int;
  v_legacy int;
begin
  select count(*)::int into v_dup from (
    select public.broki_asset_logical_key(identifier, external_id) as k
    from public.broki_assets
    group by 1
    having count(*) > 1
  ) x;

  select count(*)::int into v_orphan_g
  from public.broki_planner_groups g
  where not exists (
    select 1 from public.broki_legacy_rows r
    where r.source_table = 'grupo_trabajo'
      and r.last_migration_id = v_mid
      and r.external_id = g.external_id
  );

  select count(*)::int into v_orphan_t
  from public.broki_planner_tasks t
  where not exists (
    select 1 from public.broki_legacy_rows r
    where r.source_table = 'tareas'
      and r.last_migration_id = v_mid
      and r.external_id = t.external_id
  );

  select count(*)::int into v_smoke
  from public.broki_tooling_movements m
  where coalesce(m.bac_bact, '') ~* 'BAC-SMK|SMOKE|E2E|remote-test'
     or coalesce(m.external_id, '') ~* 'BAC-SMK|SMOKE|E2E|remote-test';

  select count(*)::int into v_broken
  from public.broki_tooling_movements m
  where m.tool_id is null
    and exists (
      select 1 from public.broki_tooling_catalog t
      where upper(t.bac_bact) = upper(m.bac_bact)
    );

  select count(*)::int into v_open_dup from (
    select upper(bac_bact) as k
    from public.broki_tooling_movements
    where date_in is null and bac_bact is not null
    group by 1 having count(*) > 1
  ) x;

  select count(*)::int into v_assets from public.broki_assets;
  select count(*)::int into v_legacy from public.broki_legacy_rows;

  return jsonb_build_object(
    'ok', v_dup = 0 and v_orphan_g = 0 and v_orphan_t = 0 and v_smoke = 0 and v_broken = 0 and v_open_dup = 0,
    'logical_asset_dups', v_dup,
    'orphan_groups', v_orphan_g,
    'orphan_tasks', v_orphan_t,
    'smoke_movements', v_smoke,
    'broken_tool_relations', v_broken,
    'open_checkout_dups', v_open_dup,
    'assets_count', v_assets,
    'legacy_rows_intact', v_legacy
  );
end;
$$;

revoke all on function public.broki_verify_canonical_cleanup(text) from public;
grant execute on function public.broki_verify_canonical_cleanup(text) to service_role;
