-- Tooling: one open checkout per BAC. Aircraft: MSN/motor columns. Atomic RPCs.

create unique index if not exists broki_tooling_movements_open_bac_unique
  on public.broki_tooling_movements (bac_bact)
  where date_in is null and bac_bact is not null;

alter table public.broki_aircraft
  add column if not exists msn text,
  add column if not exists motor text;

create or replace function public.broki_tooling_checkout(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bac text := upper(trim(p_payload ->> 'bac_bact'));
  v_tool_id uuid;
  v_aircraft_id uuid;
  v_mov public.broki_tooling_movements%rowtype;
begin
  if v_bac is null or v_bac = '' then
    raise exception 'missing_bac_bact';
  end if;

  if exists (
    select 1 from public.broki_tooling_movements
    where bac_bact = v_bac and date_in is null
  ) then
    raise exception 'open_checkout_exists';
  end if;

  select id into v_tool_id
  from public.broki_tooling_catalog
  where upper(bac_bact) = v_bac
  limit 1;

  if p_payload ? 'aircraft_id' and (p_payload ->> 'aircraft_id') ~* '^[0-9a-f-]{36}$' then
    v_aircraft_id := (p_payload ->> 'aircraft_id')::uuid;
  elsif nullif(trim(p_payload ->> 'avion'), '') is not null then
    select id into v_aircraft_id
    from public.broki_aircraft
    where upper(matricula) = upper(trim(p_payload ->> 'avion'))
    limit 1;
  end if;

  insert into public.broki_tooling_movements (
    source_system,
    source_table,
    external_id,
    tool_id,
    bac_bact,
    descripcion,
    tma_out,
    date_out,
    avion,
    aircraft_id,
    remarks
  )
  values (
    'edge_function',
    'pro.tool_control',
    coalesce(nullif(p_payload ->> 'external_id', ''), 'checkout-' || gen_random_uuid()::text),
    v_tool_id,
    v_bac,
    nullif(p_payload ->> 'descripcion', ''),
    nullif(p_payload ->> 'tma_out', ''),
    coalesce((p_payload ->> 'date_out')::timestamptz, now()),
    nullif(p_payload ->> 'avion', ''),
    v_aircraft_id,
    nullif(p_payload ->> 'remarks', '')
  )
  returning * into v_mov;

  return to_jsonb(v_mov);
end;
$$;

create or replace function public.broki_tooling_checkin(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mov public.broki_tooling_movements%rowtype;
  v_id uuid;
  v_bac text;
  v_remarks text;
begin
  if nullif(trim(p_payload ->> 'tma_in'), '') is null then
    raise exception 'missing_tma_in';
  end if;

  if (p_payload ->> 'id') ~* '^[0-9a-f-]{36}$' then
    v_id := (p_payload ->> 'id')::uuid;
    select * into v_mov
    from public.broki_tooling_movements
    where id = v_id and date_in is null
    for update;
  else
    v_bac := upper(trim(coalesce(p_payload ->> 'bac_bact', '')));
    if v_bac = '' then
      raise exception 'missing_id_or_bac';
    end if;
    select * into v_mov
    from public.broki_tooling_movements
    where bac_bact = v_bac and date_in is null
    order by date_out desc
    limit 1
    for update;
  end if;

  if v_mov.id is null then
    raise exception 'open_movement_not_found';
  end if;

  v_remarks := coalesce(v_mov.remarks, '');
  if nullif(trim(p_payload ->> 'remarks'), '') is not null then
    v_remarks := case
      when v_remarks = '' then trim(p_payload ->> 'remarks')
      else v_remarks || ' | ' || trim(p_payload ->> 'remarks')
    end;
  end if;

  update public.broki_tooling_movements
  set
    tma_in = trim(p_payload ->> 'tma_in'),
    date_in = coalesce((p_payload ->> 'date_in')::timestamptz, now()),
    remarks = v_remarks
  where id = v_mov.id
  returning * into v_mov;

  return to_jsonb(v_mov);
end;
$$;

revoke all on function public.broki_tooling_checkout(jsonb) from public;
revoke all on function public.broki_tooling_checkin(jsonb) from public;
grant execute on function public.broki_tooling_checkout(jsonb) to service_role;
grant execute on function public.broki_tooling_checkin(jsonb) to service_role;
