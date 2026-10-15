-- Fix: plpgsql record → jsonb must use row_to_json, not to_jsonb(record).

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
  v_n int;
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

  create temporary table _cc_assets on commit drop as
  select
    a.id,
    a.identifier,
    a.external_id,
    a.source_table,
    a.asset_kind,
    public.broki_asset_logical_key(a.identifier, a.external_id) as logical_key,
    (
      select lr.last_migration_id
      from public.broki_legacy_rows lr
      where lr.source_system = a.source_system
        and lr.source_table = replace(a.source_table, 'pro.', '')
        and lr.external_id = a.external_id
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
    a.ubicacion_habitual, a.legacy_id
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

  insert into public.broki_canonical_cleanup_audit (
    run_id, migration_id, dry_run, entity_type, action, canonical_id, merge_into,
    logical_key, reason, backup
  )
  select
    v_run, v_mid, p_dry_run, 'asset', 'MERGE', d.id, d.keeper_id, d.logical_key,
    case
      when d.mid = v_mid and d.asset_kind = 'inventory' then 'cross_source_inventory_vs_operational'
      else 'external_id_scheme_zombie'
    end,
    to_jsonb(a.*)
  from _cc_donors d
  join public.broki_assets a on a.id = d.id;

  insert into public.broki_canonical_cleanup_audit (
    run_id, migration_id, dry_run, entity_type, action, canonical_id, logical_key, reason
  )
  select
    v_run, v_mid, p_dry_run, 'asset', 'KEEP', k.keeper_id, k.logical_key, 'logical_keeper'
  from _cc_keepers k;

  if not p_dry_run then
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
        identifier = coalesce(nullif(r.logical_key, ''), k.identifier),
        updated_at = now()
      where k.id = r.keeper_id;

      update public.broki_incidents set asset_id = r.keeper_id where asset_id = r.id;
      get diagnostics v_n = row_count;
      v_fk_repoints := v_fk_repoints + v_n;

      update public.broki_planner_groups set vehicle_asset_id = r.keeper_id where vehicle_asset_id = r.id;
      get diagnostics v_n = row_count;
      v_fk_repoints := v_fk_repoints + v_n;

      update public.broki_asset_aliases x
      set asset_id = r.keeper_id
      where x.asset_id = r.id
        and not exists (
          select 1 from public.broki_asset_aliases y
          where y.asset_id = r.keeper_id and y.alias = x.alias
        );
      delete from public.broki_asset_aliases where asset_id = r.id;

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

  create temporary table _cc_orphan_groups on commit drop as
  select g.id, g.external_id
  from public.broki_planner_groups g
  where not exists (
    select 1 from public.broki_legacy_rows lr
    where lr.source_table = 'grupo_trabajo'
      and lr.last_migration_id = v_mid
      and lr.external_id = g.external_id
  );

  create temporary table _cc_orphan_tasks on commit drop as
  select t.id, t.external_id, t.group_id
  from public.broki_planner_tasks t
  where not exists (
    select 1 from public.broki_legacy_rows lr
    where lr.source_table = 'tareas'
      and lr.last_migration_id = v_mid
      and lr.external_id = t.external_id
  );

  insert into public.broki_canonical_cleanup_audit (
    run_id, migration_id, dry_run, entity_type, action, canonical_id, reason, backup
  )
  select v_run, v_mid, p_dry_run, 'planner_group', 'DELETE_CANDIDATE', o.id, 'orphan_group_zombie', to_jsonb(g.*)
  from _cc_orphan_groups o
  join public.broki_planner_groups g on g.id = o.id;

  insert into public.broki_canonical_cleanup_audit (
    run_id, migration_id, dry_run, entity_type, action, canonical_id, reason, backup
  )
  select v_run, v_mid, p_dry_run, 'planner_task', 'DELETE_CANDIDATE', o.id, 'orphan_task_zombie', to_jsonb(t.*)
  from _cc_orphan_tasks o
  join public.broki_planner_tasks t on t.id = o.id;

  if not p_dry_run then
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

  create temporary table _cc_smoke_moves on commit drop as
  select m.id
  from public.broki_tooling_movements m
  where coalesce(m.bac_bact, '') ~* 'BAC-SMK|SMOKE|E2E|remote-test'
     or coalesce(m.external_id, '') ~* 'BAC-SMK|SMOKE|E2E|remote-test'
     or coalesce(m.remarks, '') ~* 'BAC-SMK|SMOKE|E2E|remote-test';

  insert into public.broki_canonical_cleanup_audit (
    run_id, migration_id, dry_run, entity_type, action, canonical_id, reason, backup
  )
  select v_run, v_mid, p_dry_run, 'tooling_movement', 'DELETE_CANDIDATE', m.id, 'smoke', to_jsonb(m.*)
  from public.broki_tooling_movements m
  join _cc_smoke_moves s on s.id = m.id;

  create temporary table _cc_rebuild_moves on commit drop as
  select m.id, t.id as tool_id, m.bac_bact
  from public.broki_tooling_movements m
  join public.broki_tooling_catalog t
    on upper(t.bac_bact) = upper(m.bac_bact)
  where m.tool_id is null
    and m.bac_bact is not null
    and m.id not in (select id from _cc_smoke_moves);

  insert into public.broki_canonical_cleanup_audit (
    run_id, migration_id, dry_run, entity_type, action, canonical_id, merge_into, reason
  )
  select v_run, v_mid, p_dry_run, 'tooling_movement', 'REBUILD', x.id, x.tool_id, 'broken_relation_link_tool_id'
  from _cc_rebuild_moves x;

  create temporary table _cc_open_dup on commit drop as
  with open_m as (
    select m.id,
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

  insert into public.broki_canonical_cleanup_audit (
    run_id, migration_id, dry_run, entity_type, action, canonical_id, reason, backup
  )
  select v_run, v_mid, p_dry_run, 'tooling_movement', 'DELETE_CANDIDATE', m.id, 'duplicate_open_checkout', to_jsonb(m.*)
  from public.broki_tooling_movements m
  join _cc_open_dup d on d.id = m.id;

  if not p_dry_run then
    update public.broki_tooling_movements m
    set tool_id = x.tool_id
    from _cc_rebuild_moves x
    where m.id = x.id;
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
