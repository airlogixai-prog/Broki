-- Fase 10.4: idempotent backfill from broki_legacy_rows scoped to migration_id.
-- Does NOT delete zombies / broki_legacy_rows. dry_run default true.
-- Rollback lógico: re-run with previous payload from raw_payload snapshots (raw intact).

create or replace function public.broki_backfill_canonical_from_legacy(
  p_migration_id text,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assets_matched integer := 0;
  v_assets_would integer := 0;
  v_aircraft_matched integer := 0;
  v_aircraft_would integer := 0;
  v_tooling_matched integer := 0;
  v_tooling_would integer := 0;
begin
  if p_migration_id is null or length(trim(p_migration_id)) = 0 then
    raise exception 'p_migration_id_required';
  end if;

  -- Assets: count rows that would change worker/identifier/descripcion mapping
  select count(*)::integer into v_assets_would
  from public.broki_assets a
  join public.broki_legacy_rows r
    on r.source_system = a.source_system
   and a.source_table = 'pro.' || r.source_table
   and r.external_id = a.external_id
  where r.last_migration_id = p_migration_id
    and r.source_table in ('inventario', 'furgonetas', 'gse')
    and (
      a.current_worker_text is distinct from public.broki_jtxt(
        r.row_data, array['trabajador', 'TRABAJADOR', 'trabajadores', 'TRABAJADORES']
      )
      or a.identifier is distinct from coalesce(
        public.broki_jtxt(r.row_data, array['identificador', 'IDENTIFICADOR', 'brk', 'BRK', 'id', 'ID']),
        r.external_id
      )
      or a.descripcion is distinct from coalesce(
        public.broki_jtxt(r.row_data, array['descripcion', 'DESCRIPCION']),
        public.broki_jtxt(r.row_data, array['vehiculo', 'VEHICULO'])
      )
    );

  select count(*)::integer into v_aircraft_would
  from public.broki_aircraft a
  join public.broki_legacy_rows r
    on r.source_system = a.source_system
   and r.external_id = a.external_id
   and r.source_table = 'aviones'
  where r.last_migration_id = p_migration_id
    and (
      a.aerolinea is distinct from public.broki_jtxt(
        r.row_data, array['aerolinea', 'AEROLINEA', 'compania', 'COMPANIA']
      )
      or a.msn is distinct from public.broki_jtxt(r.row_data, array['msn', 'MSN'])
      or a.motor is distinct from public.broki_jtxt(r.row_data, array['motor', 'MOTOR'])
      or a.matricula is distinct from public.broki_jtxt(r.row_data, array['matricula', 'MATRICULA'])
      or a.modelo is distinct from public.broki_jtxt(r.row_data, array['modelo', 'MODELO'])
    );

  select count(*)::integer into v_tooling_would
  from public.broki_tooling_catalog t
  join public.broki_legacy_rows r
    on r.source_system = t.source_system
   and r.external_id = t.external_id
   and r.source_table = 'tooling'
  where r.last_migration_id = p_migration_id
    and (
      t.tipo is distinct from public.broki_jtxt(r.row_data, array['tipo', 'TIPO', 'tipo_tool', 'TIPO_TOOL'])
      or t.supplier is distinct from public.broki_jtxt(r.row_data, array['supplier', 'SUPPLIER'])
      or t.manufacturer is distinct from public.broki_jtxt(r.row_data, array['manufacturer', 'MANUFACTURER'])
      or t.bac_bact is distinct from public.broki_jtxt(
        r.row_data, array['bac_bact', 'BAC_BACT', 'bac', 'BAC', 'identificador', 'IDENTIFICADOR']
      )
    );

  if p_dry_run then
    return jsonb_build_object(
      'ok', true,
      'dry_run', true,
      'migration_id', p_migration_id,
      'assets_would_update', v_assets_would,
      'aircraft_would_update', v_aircraft_would,
      'tooling_would_update', v_tooling_would,
      'applied', false
    );
  end if;

  update public.broki_assets a
  set
    identifier = coalesce(
      public.broki_jtxt(r.row_data, array['identificador', 'IDENTIFICADOR', 'brk', 'BRK', 'id', 'ID']),
      r.external_id
    ),
    descripcion = coalesce(
      public.broki_jtxt(r.row_data, array['descripcion', 'DESCRIPCION']),
      public.broki_jtxt(r.row_data, array['vehiculo', 'VEHICULO'])
    ),
    nombre_equipo = public.broki_jtxt(r.row_data, array['nombre_equipo', 'NOMBRE_EQUIPO', 'nombre', 'NOMBRE']),
    matricula = public.broki_jtxt(r.row_data, array['matricula', 'MATRICULA']),
    current_worker_text = public.broki_jtxt(
      r.row_data, array['trabajador', 'TRABAJADOR', 'trabajadores', 'TRABAJADORES']
    ),
    raw_payload = r.row_data,
    synced_at = r.synced_at,
    updated_at = now()
  from public.broki_legacy_rows r
  where r.last_migration_id = p_migration_id
    and r.source_table in ('inventario', 'furgonetas', 'gse')
    and r.source_system = a.source_system
    and a.source_table = 'pro.' || r.source_table
    and r.external_id = a.external_id;
  get diagnostics v_assets_matched = row_count;

  update public.broki_aircraft a
  set
    matricula = public.broki_jtxt(r.row_data, array['matricula', 'MATRICULA']),
    modelo = public.broki_jtxt(r.row_data, array['modelo', 'MODELO']),
    msn = public.broki_jtxt(r.row_data, array['msn', 'MSN']),
    motor = public.broki_jtxt(r.row_data, array['motor', 'MOTOR']),
    aerolinea = public.broki_jtxt(r.row_data, array['aerolinea', 'AEROLINEA', 'compania', 'COMPANIA']),
    estado = public.broki_jtxt(r.row_data, array['estado', 'ESTADO']),
    raw_payload = r.row_data,
    synced_at = r.synced_at,
    updated_at = now()
  from public.broki_legacy_rows r
  where r.last_migration_id = p_migration_id
    and r.source_table = 'aviones'
    and r.source_system = a.source_system
    and r.external_id = a.external_id;
  get diagnostics v_aircraft_matched = row_count;

  update public.broki_tooling_catalog t
  set
    bac_bact = public.broki_jtxt(r.row_data, array[
      'bac_bact', 'BAC_BACT', 'bac', 'BAC', 'identificador', 'IDENTIFICADOR'
    ]),
    codigo = public.broki_jtxt(r.row_data, array['codigo', 'CODIGO']),
    descripcion = public.broki_jtxt(r.row_data, array['descripcion', 'DESCRIPCION']),
    familia = public.broki_jtxt(r.row_data, array['familia', 'FAMILIA']),
    estado = public.broki_jtxt(r.row_data, array['estado', 'ESTADO']),
    tipo = public.broki_jtxt(r.row_data, array['tipo', 'TIPO', 'tipo_tool', 'TIPO_TOOL']),
    supplier = public.broki_jtxt(r.row_data, array['supplier', 'SUPPLIER']),
    manufacturer = public.broki_jtxt(r.row_data, array['manufacturer', 'MANUFACTURER']),
    part_number = public.broki_jtxt(r.row_data, array['part_number', 'PART_NUMBER']),
    serial_number = public.broki_jtxt(r.row_data, array['serial_number', 'SERIAL_NUMBER']),
    ubicacion_habitual = public.broki_jtxt(r.row_data, array['ubicacion_habitual', 'UBICACION_HABITUAL']),
    raw_payload = r.row_data,
    synced_at = r.synced_at,
    updated_at = now()
  from public.broki_legacy_rows r
  where r.last_migration_id = p_migration_id
    and r.source_table = 'tooling'
    and r.source_system = t.source_system
    and r.external_id = t.external_id;
  get diagnostics v_tooling_matched = row_count;

  return jsonb_build_object(
    'ok', true,
    'dry_run', false,
    'migration_id', p_migration_id,
    'assets_updated', v_assets_matched,
    'aircraft_updated', v_aircraft_matched,
    'tooling_updated', v_tooling_matched,
    'assets_would_update_before', v_assets_would,
    'aircraft_would_update_before', v_aircraft_would,
    'tooling_would_update_before', v_tooling_would,
    'applied', true
  );
end;
$$;

grant execute on function public.broki_backfill_canonical_from_legacy(text, boolean) to service_role;

-- Verification helpers (read-only counts for gates / ops)
create or replace function public.broki_verify_alias_backfill(p_migration_id text)
returns table (
  check_name text,
  raw_with_value bigint,
  canonical_filled bigint,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  with raw_f as (
    select * from broki_legacy_rows
    where last_migration_id = p_migration_id and source_table = 'furgonetas'
  ),
  raw_g as (
    select * from broki_legacy_rows
    where last_migration_id = p_migration_id and source_table = 'gse'
  ),
  raw_a as (
    select * from broki_legacy_rows
    where last_migration_id = p_migration_id and source_table = 'aviones'
  ),
  raw_t as (
    select * from broki_legacy_rows
    where last_migration_id = p_migration_id and source_table = 'tooling'
  )
  select * from (
    select
      'furgonetas.trabajadores'::text,
      (select count(*) from raw_f r where nullif(trim(coalesce(r.row_data->>'trabajadores', r.row_data->>'trabajador', '')), '') is not null),
      (select count(*) from broki_assets a
        join raw_f r on r.external_id = a.external_id and a.source_table = 'pro.furgonetas'
        where nullif(trim(coalesce(a.current_worker_text, '')), '') is not null),
      case when (
        select count(*) from raw_f r where nullif(trim(coalesce(r.row_data->>'trabajadores', r.row_data->>'trabajador', '')), '') is not null
      ) <= (
        select count(*) from broki_assets a
        join raw_f r on r.external_id = a.external_id and a.source_table = 'pro.furgonetas'
        where nullif(trim(coalesce(a.current_worker_text, '')), '') is not null
      ) then 'OK' else 'GAP' end
    union all
    select
      'gse.brk',
      (select count(*) from raw_g r where nullif(trim(coalesce(r.row_data->>'brk', '')), '') is not null),
      (select count(*) from broki_assets a
        join raw_g r on r.external_id = a.external_id and a.source_table = 'pro.gse'
        where a.identifier is not null
          and (
            a.identifier = nullif(trim(r.row_data->>'brk'), '')
            or a.identifier = nullif(trim(r.row_data->>'identificador'), '')
            or a.identifier = r.external_id
          )),
      'CHECK'
    union all
    select
      'aviones.compania',
      (select count(*) from raw_a r where nullif(trim(coalesce(r.row_data->>'compania', r.row_data->>'aerolinea', '')), '') is not null),
      (select count(*) from broki_aircraft a
        join raw_a r on r.external_id = a.external_id
        where nullif(trim(coalesce(a.aerolinea, '')), '') is not null),
      case when (
        select count(*) from raw_a r where nullif(trim(coalesce(r.row_data->>'compania', r.row_data->>'aerolinea', '')), '') is not null
      ) <= (
        select count(*) from broki_aircraft a
        join raw_a r on r.external_id = a.external_id
        where nullif(trim(coalesce(a.aerolinea, '')), '') is not null
      ) then 'OK' else 'GAP' end
    union all
    select
      'tooling.tipo',
      (select count(*) from raw_t r where nullif(trim(coalesce(r.row_data->>'tipo', r.row_data->>'tipo_tool', '')), '') is not null),
      (select count(*) from broki_tooling_catalog t
        join raw_t r on r.external_id = t.external_id
        where nullif(trim(coalesce(t.tipo, '')), '') is not null),
      case when (
        select count(*) from raw_t r where nullif(trim(coalesce(r.row_data->>'tipo', r.row_data->>'tipo_tool', '')), '') is not null
      ) <= (
        select count(*) from broki_tooling_catalog t
        join raw_t r on r.external_id = t.external_id
        where nullif(trim(coalesce(t.tipo, '')), '') is not null
      ) then 'OK' else 'GAP' end
  ) q;
$$;

grant execute on function public.broki_verify_alias_backfill(text) to service_role;
