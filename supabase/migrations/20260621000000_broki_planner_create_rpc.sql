-- Atomic planner group creation (manual assign). Forward-only repair.

create or replace function public.broki_planner_create_group(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.broki_planner_groups%rowtype;
  v_i int;
  v_worker text;
begin
  insert into public.broki_planner_groups (
    source_system,
    source_table,
    external_id,
    id_avion,
    modelo,
    aerolinea,
    vehiculo,
    responsable,
    hora_llegada,
    hora_salida,
    destino,
    fecha_modificacion
  )
  values (
    'edge_function',
    'pro.grupo_trabajo',
    coalesce(p_payload ->> 'external_id', 'group-' || gen_random_uuid()::text),
    p_payload ->> 'id_avion',
    nullif(p_payload ->> 'modelo', ''),
    nullif(p_payload ->> 'aerolinea', ''),
    nullif(p_payload ->> 'vehiculo', ''),
    nullif(p_payload ->> 'responsable', ''),
    nullif(p_payload ->> 'hora_llegada', ''),
    nullif(p_payload ->> 'hora_salida', ''),
    nullif(p_payload ->> 'destino', ''),
    coalesce((p_payload ->> 'timestamp')::timestamptz, now())
  )
  returning * into v_group;

  for v_i in 1..10 loop
    v_worker := nullif(trim(p_payload ->> ('trabajador_' || v_i)), '');
    if v_worker is not null then
      insert into public.broki_planner_group_members (group_id, position, worker_text)
      values (v_group.id, v_i, v_worker);
    end if;
  end loop;

  return jsonb_build_object(
    'group', to_jsonb(v_group),
    'members', (
      select coalesce(jsonb_agg(to_jsonb(m) order by m.position), '[]'::jsonb)
      from public.broki_planner_group_members m
      where m.group_id = v_group.id
    )
  );
end;
$$;

revoke all on function public.broki_planner_create_group(jsonb) from public;
grant execute on function public.broki_planner_create_group(jsonb) to service_role;
