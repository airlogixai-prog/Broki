-- Forward-only: data parity audit helpers + planner task group external id.
-- Does not delete or rewrite broki_legacy_rows.

-- ---------------------------------------------------------------------------
-- Planner: persist grupo_trabajo FK text from raw (was link-only via row_data).
-- ---------------------------------------------------------------------------

alter table public.broki_planner_tasks
  add column if not exists grupo_trabajo_external_id text;

create index if not exists broki_planner_tasks_grupo_ext_idx
  on public.broki_planner_tasks (grupo_trabajo_external_id)
  where grupo_trabajo_external_id is not null;

create or replace function public.broki_normalize_planner_tasks()
returns integer
language plpgsql
as $$
declare n integer;
begin
  insert into public.broki_planner_tasks (
    source_system, source_table, external_id, legacy_id,
    grupo_trabajo_external_id,
    tipo_tarea, codigo, matricula_avion, prioridad, descripcion, notas,
    estado, fecha, fecha_modificacion, raw_payload, synced_at
  )
  select
    r.source_system,
    'pro.tareas',
    r.external_id,
    public.broki_jbigint(r.row_data, array['id', 'ID']),
    public.broki_jtxt(r.row_data, array['id_grupo_trabajo', 'ID_GRUPO_TRABAJO']),
    public.broki_jtxt(r.row_data, array['tipo_tarea', 'TIPO_TAREA']),
    public.broki_jtxt(r.row_data, array['codigo', 'CODIGO']),
    public.broki_jtxt(r.row_data, array['matricula_avion', 'MATRICULA_AVION', 'matricula', 'MATRICULA']),
    public.broki_jtxt(r.row_data, array['prioridad', 'PRIORIDAD']),
    public.broki_jtxt(r.row_data, array['descripcion', 'DESCRIPCION']),
    public.broki_jtxt(r.row_data, array['notas', 'NOTAS']),
    public.broki_jint(r.row_data, array['estado', 'ESTADO']),
    public.broki_jtimestamptz(r.row_data, array['fecha', 'FECHA']),
    public.broki_jtimestamptz(r.row_data, array['fecha_modificacion', 'FECHA_MODIFICACION']),
    r.row_data,
    r.synced_at
  from public.broki_legacy_rows r
  where r.source_table = 'tareas'
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
    synced_at = excluded.synced_at;

  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.broki_normalize_legacy_links()
returns void
language plpgsql
as $$
begin
  update public.broki_incidents i
  set asset_id = a.id
  from public.broki_assets a
  where i.asset_id is null
    and i.id_objeto is not null
    and a.identifier = i.id_objeto;

  update public.broki_incidents i
  set worker_id = p.id
  from public.broki_personnel p
  where i.worker_id is null
    and i.trabajador_text is not null
    and lower(trim(p.nombre)) = lower(trim(i.trabajador_text));

  update public.broki_planner_groups g
  set aircraft_id = ac.id
  from public.broki_aircraft ac
  where g.aircraft_id is null
    and g.id_avion is not null
    and ac.matricula = g.id_avion;

  update public.broki_planner_groups g
  set responsible_person_id = p.id
  from public.broki_personnel p
  where g.responsible_person_id is null
    and g.responsable is not null
    and lower(trim(p.nombre)) = lower(trim(g.responsable));

  update public.broki_planner_group_members m
  set person_id = p.id
  from public.broki_personnel p
  where m.person_id is null
    and m.worker_text is not null
    and lower(trim(p.nombre)) = lower(trim(m.worker_text));

  update public.broki_planner_tasks t
  set aircraft_id = ac.id
  from public.broki_aircraft ac
  where t.aircraft_id is null
    and t.matricula_avion is not null
    and ac.matricula = t.matricula_avion;

  update public.broki_planner_tasks t
  set group_id = g.id
  from public.broki_planner_groups g
  where t.group_id is null
    and t.grupo_trabajo_external_id is not null
    and g.source_system = t.source_system
    and g.external_id = t.grupo_trabajo_external_id;

  -- Fallback: rows imported before grupo_trabajo_external_id column existed.
  update public.broki_planner_tasks t
  set group_id = g.id
  from public.broki_legacy_rows r
  join public.broki_planner_groups g
    on g.source_system = r.source_system
    and g.external_id = public.broki_jtxt(r.row_data, array['id_grupo_trabajo', 'ID_GRUPO_TRABAJO'])
  where t.group_id is null
    and t.grupo_trabajo_external_id is null
    and r.source_table = 'tareas'
    and t.source_system = r.source_system
    and t.external_id = r.external_id;

  update public.broki_tooling_movements tm
  set tool_id = tc.id
  from public.broki_tooling_catalog tc
  where tm.tool_id is null
    and tm.bac_bact is not null
    and tc.bac_bact = tm.bac_bact;

  update public.broki_tooling_movements tm
  set aircraft_id = ac.id
  from public.broki_aircraft ac
  where tm.aircraft_id is null
    and tm.avion is not null
    and ac.matricula = tm.avion;

  update public.broki_assets ast
  set aircraft_id = ac.id
  from public.broki_aircraft ac
  where ast.aircraft_id is null
    and ast.avion_text is not null
    and ac.matricula = ast.avion_text;

  update public.broki_assets ast
  set current_worker_id = p.id
  from public.broki_personnel p
  where ast.current_worker_id is null
    and ast.current_worker_text is not null
    and lower(trim(p.nombre)) = lower(trim(ast.current_worker_text));

  update public.broki_communications c
  set person_id = p.id
  from public.broki_personnel p
  where c.person_id is null
    and c.telefono is not null
    and p.telefono = c.telefono;
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit: row counts raw vs canonical (wraps existing validate).
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Audit: raw_payload on canonical must equal broki_legacy_rows.row_data.
-- ---------------------------------------------------------------------------

create or replace function public.broki_audit_raw_payload_parity()
returns table(
  canonical_table text,
  external_id text,
  issue text
)
language sql
stable
as $$
  select 'broki_personnel', p.external_id, 'raw_payload drift'
  from public.broki_personnel p
  join public.broki_legacy_rows r
    on r.source_system = p.source_system
   and r.source_table = 'personal'
   and r.external_id = p.external_id
  where p.raw_payload is distinct from r.row_data
  union all
  select 'broki_aircraft', a.external_id, 'raw_payload drift'
  from public.broki_aircraft a
  join public.broki_legacy_rows r
    on r.source_system = a.source_system and r.source_table = 'aviones' and r.external_id = a.external_id
  where a.raw_payload is distinct from r.row_data
  union all
  select 'broki_assets', ast.external_id, 'raw_payload drift'
  from public.broki_assets ast
  join public.broki_legacy_rows r
    on r.source_system = ast.source_system
   and r.source_table = split_part(ast.source_table, '.', 2)
   and r.external_id = ast.external_id
  where ast.raw_payload is distinct from r.row_data
  union all
  select 'broki_incidents', i.external_id, 'raw_payload drift'
  from public.broki_incidents i
  join public.broki_legacy_rows r
    on r.source_system = i.source_system and r.source_table = 'incidencias' and r.external_id = i.external_id
  where i.raw_payload is distinct from r.row_data
  union all
  select 'broki_planner_groups', g.external_id, 'raw_payload drift'
  from public.broki_planner_groups g
  join public.broki_legacy_rows r
    on r.source_system = g.source_system and r.source_table = 'grupo_trabajo' and r.external_id = g.external_id
  where g.raw_payload is distinct from r.row_data
  union all
  select 'broki_planner_tasks', t.external_id, 'raw_payload drift'
  from public.broki_planner_tasks t
  join public.broki_legacy_rows r
    on r.source_system = t.source_system and r.source_table = 'tareas' and r.external_id = t.external_id
  where t.raw_payload is distinct from r.row_data
  union all
  select 'broki_tooling_catalog', tc.external_id, 'raw_payload drift'
  from public.broki_tooling_catalog tc
  join public.broki_legacy_rows r
    on r.source_system = tc.source_system and r.source_table = 'tooling' and r.external_id = tc.external_id
  where tc.raw_payload is distinct from r.row_data
  union all
  select 'broki_tooling_movements', tm.external_id, 'raw_payload drift'
  from public.broki_tooling_movements tm
  join public.broki_legacy_rows r
    on r.source_system = tm.source_system and r.source_table = 'tool_control' and r.external_id = tm.external_id
  where tm.raw_payload is distinct from r.row_data
  union all
  select 'broki_communications', c.external_id, 'raw_payload drift'
  from public.broki_communications c
  join public.broki_legacy_rows r
    on r.source_system = c.source_system and r.source_table = 'registro_comunicaciones' and r.external_id = c.external_id
  where c.raw_payload is distinct from r.row_data
  union all
  select 'broki_chat_histories', ch.external_id, 'raw_payload drift'
  from public.broki_chat_histories ch
  join public.broki_legacy_rows r
    on r.source_system = ch.source_system and r.source_table = 'n8n_chat_histories' and r.external_id = ch.external_id
  where ch.raw_payload is distinct from r.row_data
  union all
  select 'broki_unknown_contacts', u.external_id, 'raw_payload drift'
  from public.broki_unknown_contacts u
  join public.broki_legacy_rows r
    on r.source_system = u.source_system and r.source_table = 'no_existe_telefono' and r.external_id = u.external_id
  where u.raw_payload is distinct from r.row_data
  union all
  select 'broki_nitro_stock', n.external_id, 'raw_payload drift'
  from public.broki_nitro_stock n
  join public.broki_legacy_rows r
    on r.source_system = n.source_system and r.source_table = 'nitro_stock' and r.external_id = n.external_id
  where n.raw_payload is distinct from r.row_data;
$$;

-- ---------------------------------------------------------------------------
-- Audit: aggregate JSON keys observed in broki_legacy_rows per source_table.
-- ---------------------------------------------------------------------------

create or replace function public.broki_audit_legacy_row_keys()
returns table(
  source_table text,
  json_key text,
  row_count bigint
)
language sql
stable
as $$
  select
    r.source_table,
    k.key,
    count(*)::bigint
  from public.broki_legacy_rows r
  cross join lateral jsonb_object_keys(r.row_data) as k(key)
  group by r.source_table, k.key
  order by r.source_table, k.key;
$$;

grant execute on function public.broki_audit_entity_counts() to service_role;
grant execute on function public.broki_audit_raw_payload_parity() to service_role;
grant execute on function public.broki_audit_legacy_row_keys() to service_role;
