-- Fase 10.2: fix RAW→canonical aliases (forward-only replace functions).
-- No DELETE of zombie rows. No coalesce msn→matricula / motor→modelo.

create or replace function public.broki_normalize_aircraft()
returns integer
language plpgsql
as $$
declare n integer;
begin
  insert into public.broki_aircraft (
    source_system, source_table, external_id, legacy_id,
    matricula, modelo, msn, motor, aerolinea, estado, raw_payload, synced_at
  )
  select
    r.source_system,
    'pro.aviones',
    r.external_id,
    public.broki_jbigint(r.row_data, array['id', 'ID']),
    public.broki_jtxt(r.row_data, array['matricula', 'MATRICULA']),
    public.broki_jtxt(r.row_data, array['modelo', 'MODELO']),
    public.broki_jtxt(r.row_data, array['msn', 'MSN']),
    public.broki_jtxt(r.row_data, array['motor', 'MOTOR']),
    public.broki_jtxt(r.row_data, array['aerolinea', 'AEROLINEA', 'compania', 'COMPANIA']),
    public.broki_jtxt(r.row_data, array['estado', 'ESTADO']),
    r.row_data,
    r.synced_at
  from public.broki_legacy_rows r
  where r.source_table = 'aviones'
  on conflict (source_system, external_id) do update set
    legacy_id = excluded.legacy_id,
    matricula = excluded.matricula,
    modelo = excluded.modelo,
    msn = excluded.msn,
    motor = excluded.motor,
    aerolinea = excluded.aerolinea,
    estado = excluded.estado,
    raw_payload = excluded.raw_payload,
    synced_at = excluded.synced_at;

  get diagnostics n = row_count;
  return n;
end;
$$;

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

create or replace function public.broki_normalize_tooling_catalog()
returns integer
language plpgsql
as $$
declare n integer;
begin
  insert into public.broki_tooling_catalog (
    source_system, source_table, external_id, legacy_id,
    bac_bact, codigo, descripcion, familia, estado,
    tipo, supplier, manufacturer, part_number, serial_number, ubicacion_habitual,
    raw_payload, synced_at
  )
  select
    r.source_system,
    'pro.tooling',
    r.external_id,
    public.broki_jbigint(r.row_data, array['id', 'ID']),
    public.broki_jtxt(r.row_data, array[
      'bac_bact', 'BAC_BACT', 'bac', 'BAC', 'identificador', 'IDENTIFICADOR'
    ]),
    public.broki_jtxt(r.row_data, array['codigo', 'CODIGO']),
    public.broki_jtxt(r.row_data, array['descripcion', 'DESCRIPCION']),
    public.broki_jtxt(r.row_data, array['familia', 'FAMILIA']),
    public.broki_jtxt(r.row_data, array['estado', 'ESTADO']),
    public.broki_jtxt(r.row_data, array['tipo', 'TIPO', 'tipo_tool', 'TIPO_TOOL']),
    public.broki_jtxt(r.row_data, array['supplier', 'SUPPLIER']),
    public.broki_jtxt(r.row_data, array['manufacturer', 'MANUFACTURER']),
    public.broki_jtxt(r.row_data, array['part_number', 'PART_NUMBER']),
    public.broki_jtxt(r.row_data, array['serial_number', 'SERIAL_NUMBER']),
    public.broki_jtxt(r.row_data, array['ubicacion_habitual', 'UBICACION_HABITUAL']),
    r.row_data,
    r.synced_at
  from public.broki_legacy_rows r
  where r.source_table = 'tooling'
  on conflict (source_system, external_id) do update set
    legacy_id = excluded.legacy_id,
    bac_bact = excluded.bac_bact,
    codigo = excluded.codigo,
    descripcion = excluded.descripcion,
    familia = excluded.familia,
    estado = excluded.estado,
    tipo = excluded.tipo,
    supplier = excluded.supplier,
    manufacturer = excluded.manufacturer,
    part_number = excluded.part_number,
    serial_number = excluded.serial_number,
    ubicacion_habitual = excluded.ubicacion_habitual,
    raw_payload = excluded.raw_payload,
    synced_at = excluded.synced_at;

  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.broki_normalize_aircraft() to service_role;
grant execute on function public.broki_normalize_assets() to service_role;
grant execute on function public.broki_normalize_tooling_catalog() to service_role;
