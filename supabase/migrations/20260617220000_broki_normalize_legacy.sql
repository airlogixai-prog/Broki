-- BROKI: normalize broki_legacy_rows -> broki_* canonical tables.
-- Idempotent upserts; safe to re-run after new raw imports.

-- ponytail: tiny json helpers; upgrade path = typed per-entity parsers if shapes diverge
create or replace function public.broki_jtxt(j jsonb, keys text[])
returns text
language plpgsql
immutable
as $$
declare k text;
begin
  if j is null then return null; end if;
  foreach k in array keys loop
    if j ? k and nullif(trim(j->>k), '') is not null then
      return trim(j->>k);
    end if;
  end loop;
  return null;
end;
$$;

create or replace function public.broki_jbigint(j jsonb, keys text[])
returns bigint
language sql
immutable
as $$
  select nullif(public.broki_jtxt(j, keys), '')::bigint;
$$;

create or replace function public.broki_jint(j jsonb, keys text[])
returns integer
language sql
immutable
as $$
  select nullif(public.broki_jtxt(j, keys), '')::integer;
$$;

create or replace function public.broki_jnumeric(j jsonb, keys text[])
returns numeric
language sql
immutable
as $$
  select nullif(public.broki_jtxt(j, keys), '')::numeric;
$$;

create or replace function public.broki_jtimestamptz(j jsonb, keys text[])
returns timestamptz
language sql
immutable
as $$
  select nullif(public.broki_jtxt(j, keys), '')::timestamptz;
$$;

create or replace function public.broki_jdate(j jsonb, keys text[])
returns date
language sql
immutable
as $$
  select nullif(public.broki_jtxt(j, keys), '')::date;
$$;

create or replace function public.broki_jbool(j jsonb, keys text[])
returns boolean
language sql
immutable
as $$
  select case lower(coalesce(public.broki_jtxt(j, keys), ''))
    when 'true' then true
    when 't' then true
    when '1' then true
    when 'yes' then true
    when 'false' then false
    when 'f' then false
    when '0' then false
    when 'no' then false
    else null
  end;
$$;

-- ---------------------------------------------------------------------------
-- Entity normalizers
-- ---------------------------------------------------------------------------

create or replace function public.broki_normalize_personnel()
returns integer
language plpgsql
as $$
declare n integer;
begin
  insert into public.broki_personnel (
    source_system, source_table, external_id, legacy_id,
    nombre, cod_empleado_aena, telefono, correo, id_chat, estado,
    fecha_alta, fecha_baja, fecha_modificacion,
    helper, cat_a, b1, b2, certificador, n_bac,
    a_a320_family, a_airbus_a330, a_airbus_a350, a_boeing_737, a_boeing_787,
    a_boeing_777, a_atr_42_72, a_embraer_e_jet, a_bombardier_crj, a_otros,
    b1_a320_family, b1_airbus_a330, b1_airbus_a350, b1_boeing_737, b1_boeing_787,
    b1_boeing_777, b1_atr_42_72, b1_embraer_e_jet, b1_bombardier_crj, b1_otros,
    b2_a320_family, b2_airbus_a330, b2_airbus_a350, b2_boeing_737, b2_boeing_787,
    b2_boeing_777, b2_atr_42_72, b2_embraer_e_jet, b2_bombardier_crj, b2_otros,
    raw_payload, synced_at
  )
  select
    r.source_system,
    'pro.personal',
    r.external_id,
    public.broki_jbigint(r.row_data, array['id', 'ID']),
    coalesce(public.broki_jtxt(r.row_data, array['nombre', 'NOMBRE']), '(sin nombre)'),
    public.broki_jtxt(r.row_data, array['cod_empleado_aena', 'COD_EMPLEADO_AENA']),
    public.broki_jtxt(r.row_data, array['telefono', 'TELEFONO']),
    public.broki_jtxt(r.row_data, array['correo', 'CORREO']),
    public.broki_jtxt(r.row_data, array['id_chat', 'ID_CHAT']),
    public.broki_jint(r.row_data, array['estado', 'ESTADO']),
    public.broki_jdate(r.row_data, array['fecha_alta', 'FECHA_ALTA']),
    public.broki_jtimestamptz(r.row_data, array['fecha_baja', 'FECHA_BAJA']),
    public.broki_jtimestamptz(r.row_data, array['fecha_modificacion', 'FECHA_MODIFICACION']),
    public.broki_jbool(r.row_data, array['helper', 'HELPER']),
    public.broki_jbool(r.row_data, array['cat_a', 'CAT_A']),
    public.broki_jbool(r.row_data, array['b1', 'B1']),
    public.broki_jbool(r.row_data, array['b2', 'B2']),
    public.broki_jbool(r.row_data, array['certificador', 'CERTIFICADOR']),
    public.broki_jtxt(r.row_data, array['n_bac', 'N_BAC']),
    public.broki_jint(r.row_data, array['a_a320_family', 'A_A320_FAMILY']),
    public.broki_jint(r.row_data, array['a_airbus_a330', 'A_AIRBUS_A330']),
    public.broki_jint(r.row_data, array['a_airbus_a350', 'A_AIRBUS_A350']),
    public.broki_jint(r.row_data, array['a_boeing_737', 'A_BOEING_737']),
    public.broki_jint(r.row_data, array['a_boeing_787', 'A_BOEING_787']),
    public.broki_jint(r.row_data, array['a_boeing_777', 'A_BOEING_777']),
    public.broki_jint(r.row_data, array['a_atr_42_72', 'A_ATR_42_72']),
    public.broki_jint(r.row_data, array['a_embraer_e_jet', 'A_EMBRAER_E_JET']),
    public.broki_jint(r.row_data, array['a_bombardier_crj', 'A_BOMBARDIER_CRJ']),
    public.broki_jint(r.row_data, array['a_otros', 'A_OTROS']),
    public.broki_jint(r.row_data, array['b1_a320_family', 'B1_A320_FAMILY']),
    public.broki_jint(r.row_data, array['b1_airbus_a330', 'B1_AIRBUS_A330']),
    public.broki_jint(r.row_data, array['b1_airbus_a350', 'B1_AIRBUS_A350']),
    public.broki_jint(r.row_data, array['b1_boeing_737', 'B1_BOEING_737']),
    public.broki_jint(r.row_data, array['b1_boeing_787', 'B1_BOEING_787']),
    public.broki_jint(r.row_data, array['b1_boeing_777', 'B1_BOEING_777']),
    public.broki_jint(r.row_data, array['b1_atr_42_72', 'B1_ATR_42_72']),
    public.broki_jint(r.row_data, array['b1_embraer_e_jet', 'B1_EMBRAER_E_JET']),
    public.broki_jint(r.row_data, array['b1_bombardier_crj', 'B1_BOMBARDIER_CRJ']),
    public.broki_jint(r.row_data, array['b1_otros', 'B1_OTROS']),
    public.broki_jint(r.row_data, array['b2_a320_family', 'B2_A320_FAMILY']),
    public.broki_jint(r.row_data, array['b2_airbus_a330', 'B2_AIRBUS_A330']),
    public.broki_jint(r.row_data, array['b2_airbus_a350', 'B2_AIRBUS_A350']),
    public.broki_jint(r.row_data, array['b2_boeing_737', 'B2_BOEING_737']),
    public.broki_jint(r.row_data, array['b2_boeing_787', 'B2_BOEING_787']),
    public.broki_jint(r.row_data, array['b2_boeing_777', 'B2_BOEING_777']),
    public.broki_jint(r.row_data, array['b2_atr_42_72', 'B2_ATR_42_72']),
    public.broki_jint(r.row_data, array['b2_embraer_e_jet', 'B2_EMBRAER_E_JET']),
    public.broki_jint(r.row_data, array['b2_bombardier_crj', 'B2_BOMBARDIER_CRJ']),
    public.broki_jint(r.row_data, array['b2_otros', 'B2_OTROS']),
    r.row_data,
    r.synced_at
  from public.broki_legacy_rows r
  where r.source_table = 'personal'
  on conflict (source_system, external_id) do update set
    legacy_id = excluded.legacy_id,
    nombre = excluded.nombre,
    cod_empleado_aena = excluded.cod_empleado_aena,
    telefono = excluded.telefono,
    correo = excluded.correo,
    id_chat = excluded.id_chat,
    estado = excluded.estado,
    fecha_alta = excluded.fecha_alta,
    fecha_baja = excluded.fecha_baja,
    fecha_modificacion = excluded.fecha_modificacion,
    helper = excluded.helper,
    cat_a = excluded.cat_a,
    b1 = excluded.b1,
    b2 = excluded.b2,
    certificador = excluded.certificador,
    n_bac = excluded.n_bac,
    a_a320_family = excluded.a_a320_family,
    a_airbus_a330 = excluded.a_airbus_a330,
    a_airbus_a350 = excluded.a_airbus_a350,
    a_boeing_737 = excluded.a_boeing_737,
    a_boeing_787 = excluded.a_boeing_787,
    a_boeing_777 = excluded.a_boeing_777,
    a_atr_42_72 = excluded.a_atr_42_72,
    a_embraer_e_jet = excluded.a_embraer_e_jet,
    a_bombardier_crj = excluded.a_bombardier_crj,
    a_otros = excluded.a_otros,
    b1_a320_family = excluded.b1_a320_family,
    b1_airbus_a330 = excluded.b1_airbus_a330,
    b1_airbus_a350 = excluded.b1_airbus_a350,
    b1_boeing_737 = excluded.b1_boeing_737,
    b1_boeing_787 = excluded.b1_boeing_787,
    b1_boeing_777 = excluded.b1_boeing_777,
    b1_atr_42_72 = excluded.b1_atr_42_72,
    b1_embraer_e_jet = excluded.b1_embraer_e_jet,
    b1_bombardier_crj = excluded.b1_bombardier_crj,
    b1_otros = excluded.b1_otros,
    b2_a320_family = excluded.b2_a320_family,
    b2_airbus_a330 = excluded.b2_airbus_a330,
    b2_airbus_a350 = excluded.b2_airbus_a350,
    b2_boeing_737 = excluded.b2_boeing_737,
    b2_boeing_787 = excluded.b2_boeing_787,
    b2_boeing_777 = excluded.b2_boeing_777,
    b2_atr_42_72 = excluded.b2_atr_42_72,
    b2_embraer_e_jet = excluded.b2_embraer_e_jet,
    b2_bombardier_crj = excluded.b2_bombardier_crj,
    b2_otros = excluded.b2_otros,
    raw_payload = excluded.raw_payload,
    synced_at = excluded.synced_at;

  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.broki_normalize_aircraft()
returns integer
language plpgsql
as $$
declare n integer;
begin
  insert into public.broki_aircraft (
    source_system, source_table, external_id, legacy_id,
    matricula, modelo, aerolinea, estado, raw_payload, synced_at
  )
  select
    r.source_system,
    'pro.aviones',
    r.external_id,
    public.broki_jbigint(r.row_data, array['id', 'ID']),
    public.broki_jtxt(r.row_data, array['matricula', 'MATRICULA', 'msn', 'MSN']),
    public.broki_jtxt(r.row_data, array['modelo', 'MODELO', 'motor', 'MOTOR']),
    public.broki_jtxt(r.row_data, array['aerolinea', 'AEROLINEA']),
    public.broki_jtxt(r.row_data, array['estado', 'ESTADO']),
    r.row_data,
    r.synced_at
  from public.broki_legacy_rows r
  where r.source_table = 'aviones'
  on conflict (source_system, external_id) do update set
    legacy_id = excluded.legacy_id,
    matricula = excluded.matricula,
    modelo = excluded.modelo,
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
    public.broki_jbigint(r.row_data, array['id', 'ID', 'identificador', 'IDENTIFICADOR']),
    case r.source_table
      when 'inventario' then 'inventory'
      when 'furgonetas' then 'van'
      when 'gse' then 'gse'
      else 'other'
    end,
    coalesce(
      public.broki_jtxt(r.row_data, array['identificador', 'IDENTIFICADOR', 'id', 'ID']),
      r.external_id
    ),
    public.broki_jtxt(r.row_data, array['descripcion', 'DESCRIPCION']),
    public.broki_jtxt(r.row_data, array['nombre_equipo', 'NOMBRE_EQUIPO', 'nombre', 'NOMBRE']),
    public.broki_jtxt(r.row_data, array['matricula', 'MATRICULA']),
    public.broki_jtxt(r.row_data, array['familia', 'FAMILIA']),
    public.broki_jtxt(r.row_data, array['plazas', 'PLAZAS']),
    public.broki_jtxt(r.row_data, array['estado', 'ESTADO']),
    public.broki_jtxt(r.row_data, array['ubicacion_habitual', 'UBICACION_HABITUAL']),
    public.broki_jtxt(r.row_data, array['parking', 'PARKING']),
    public.broki_jtxt(r.row_data, array['avion', 'AVION']),
    public.broki_jtxt(r.row_data, array['trabajador', 'TRABAJADOR']),
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

create or replace function public.broki_normalize_unknown_contacts()
returns integer
language plpgsql
as $$
declare n integer;
begin
  insert into public.broki_unknown_contacts (
    source_system, source_table, external_id, legacy_id,
    id_chat, first_name, last_name, telefono, mensaje, fecha_modificacion,
    raw_payload, synced_at
  )
  select
    r.source_system,
    'pro.no_existe_telefono',
    r.external_id,
    public.broki_jbigint(r.row_data, array['id', 'ID']),
    public.broki_jtxt(r.row_data, array['id_chat', 'ID_CHAT']),
    public.broki_jtxt(r.row_data, array['first_name', 'FIRST_NAME', 'nombre', 'NOMBRE']),
    public.broki_jtxt(r.row_data, array['last_name', 'LAST_NAME', 'apellido', 'APELLIDO']),
    coalesce(public.broki_jtxt(r.row_data, array['telefono', 'TELEFONO']), r.external_id),
    public.broki_jtxt(r.row_data, array['mensaje', 'MENSAJE']),
    public.broki_jtimestamptz(r.row_data, array['fecha_modificacion', 'FECHA_MODIFICACION']),
    r.row_data,
    r.synced_at
  from public.broki_legacy_rows r
  where r.source_table = 'no_existe_telefono'
  on conflict (source_system, external_id) do update set
    legacy_id = excluded.legacy_id,
    id_chat = excluded.id_chat,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    telefono = excluded.telefono,
    mensaje = excluded.mensaje,
    fecha_modificacion = excluded.fecha_modificacion,
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
    bac_bact, codigo, descripcion, familia, estado, raw_payload, synced_at
  )
  select
    r.source_system,
    'pro.tooling',
    r.external_id,
    public.broki_jbigint(r.row_data, array['id', 'ID']),
    public.broki_jtxt(r.row_data, array['bac_bact', 'BAC_BACT', 'bac', 'BAC']),
    public.broki_jtxt(r.row_data, array['codigo', 'CODIGO']),
    public.broki_jtxt(r.row_data, array['descripcion', 'DESCRIPCION']),
    public.broki_jtxt(r.row_data, array['familia', 'FAMILIA']),
    public.broki_jtxt(r.row_data, array['estado', 'ESTADO']),
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
    raw_payload = excluded.raw_payload,
    synced_at = excluded.synced_at;

  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.broki_normalize_nitro_stock()
returns integer
language plpgsql
as $$
declare n integer;
begin
  insert into public.broki_nitro_stock (
    source_system, source_table, external_id,
    ubicacion, botellas_llenas, botellas_vacias, raw_payload, synced_at
  )
  select
    r.source_system,
    'nitro_stock',
    r.external_id,
    coalesce(
      public.broki_jtxt(r.row_data, array['ubicacion', 'UBICACION']),
      r.external_id
    ),
    public.broki_jint(r.row_data, array['cantida_de_botellas_llenas', 'cantidad_de_botellas_llenas', 'botellas_llenas']),
    public.broki_jint(r.row_data, array['cantidad_de_botellas_vacias', 'botellas_vacias']),
    r.row_data,
    r.synced_at
  from public.broki_legacy_rows r
  where r.source_table = 'nitro_stock'
  on conflict (source_system, external_id) do update set
    ubicacion = excluded.ubicacion,
    botellas_llenas = excluded.botellas_llenas,
    botellas_vacias = excluded.botellas_vacias,
    raw_payload = excluded.raw_payload,
    synced_at = excluded.synced_at;

  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.broki_normalize_incidents()
returns integer
language plpgsql
as $$
declare n integer;
begin
  insert into public.broki_incidents (
    source_system, source_table, external_id, legacy_id,
    incident_code, id_objeto, descripcion, estado, status_text,
    trabajador_text, fecha_apertura, fecha_cierre, fecha_modificacion,
    raw_payload, synced_at
  )
  select
    r.source_system,
    'pro.incidencias',
    r.external_id,
    public.broki_jbigint(r.row_data, array['id', 'ID', 'id_incidencia', 'ID_INCIDENCIA']),
    public.broki_jtxt(r.row_data, array['id_incidencia', 'ID_INCIDENCIA', 'codigo', 'CODIGO']),
    public.broki_jtxt(r.row_data, array['id_objeto', 'ID_OBJETO']),
    public.broki_jtxt(r.row_data, array['descripcion', 'DESCRIPCION']),
    public.broki_jint(r.row_data, array['estado', 'ESTADO']),
    public.broki_jtxt(r.row_data, array['status', 'STATUS', 'status_text', 'STATUS_TEXT']),
    public.broki_jtxt(r.row_data, array['trabajador', 'TRABAJADOR']),
    public.broki_jtimestamptz(r.row_data, array['fecha_apertura', 'FECHA_APERTURA']),
    public.broki_jtimestamptz(r.row_data, array['fecha_cierre', 'FECHA_CIERRE']),
    public.broki_jtimestamptz(r.row_data, array['fecha_modificacion', 'FECHA_MODIFICACION']),
    r.row_data,
    r.synced_at
  from public.broki_legacy_rows r
  where r.source_table = 'incidencias'
  on conflict (source_system, external_id) do update set
    legacy_id = excluded.legacy_id,
    incident_code = excluded.incident_code,
    id_objeto = excluded.id_objeto,
    descripcion = excluded.descripcion,
    estado = excluded.estado,
    status_text = excluded.status_text,
    trabajador_text = excluded.trabajador_text,
    fecha_apertura = excluded.fecha_apertura,
    fecha_cierre = excluded.fecha_cierre,
    fecha_modificacion = excluded.fecha_modificacion,
    raw_payload = excluded.raw_payload,
    synced_at = excluded.synced_at;

  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.broki_normalize_planner_groups()
returns integer
language plpgsql
as $$
declare n integer;
begin
  insert into public.broki_planner_groups (
    source_system, source_table, external_id, legacy_id,
    id_avion, modelo, aerolinea, vehiculo, responsable,
    hora_llegada, hora_salida, destino, fecha_modificacion,
    raw_payload, synced_at
  )
  select
    r.source_system,
    'pro.grupo_trabajo',
    r.external_id,
    public.broki_jbigint(r.row_data, array['id', 'ID']),
    public.broki_jtxt(r.row_data, array['id_avion', 'ID_AVION']),
    public.broki_jtxt(r.row_data, array['modelo', 'MODELO']),
    public.broki_jtxt(r.row_data, array['aerolinea', 'AEROLINEA']),
    public.broki_jtxt(r.row_data, array['vehiculo', 'VEHICULO']),
    public.broki_jtxt(r.row_data, array['responsable', 'RESPONSABLE']),
    public.broki_jtimestamptz(r.row_data, array['hora_llegada', 'HORA_LLEGADA']),
    public.broki_jtimestamptz(r.row_data, array['hora_salida', 'HORA_SALIDA']),
    public.broki_jtxt(r.row_data, array['destino', 'DESTINO']),
    public.broki_jtimestamptz(r.row_data, array['fecha_modificacion', 'FECHA_MODIFICACION']),
    r.row_data,
    r.synced_at
  from public.broki_legacy_rows r
  where r.source_table = 'grupo_trabajo'
  on conflict (source_system, external_id) do update set
    legacy_id = excluded.legacy_id,
    id_avion = excluded.id_avion,
    modelo = excluded.modelo,
    aerolinea = excluded.aerolinea,
    vehiculo = excluded.vehiculo,
    responsable = excluded.responsable,
    hora_llegada = excluded.hora_llegada,
    hora_salida = excluded.hora_salida,
    destino = excluded.destino,
    fecha_modificacion = excluded.fecha_modificacion,
    raw_payload = excluded.raw_payload,
    synced_at = excluded.synced_at;

  get diagnostics n = row_count;

  -- members trabajador_1..10
  delete from public.broki_planner_group_members m
  using public.broki_planner_groups g, public.broki_legacy_rows r
  where g.id = m.group_id
    and g.source_system = r.source_system
    and g.external_id = r.external_id
    and r.source_table = 'grupo_trabajo';

  insert into public.broki_planner_group_members (group_id, position, worker_text)
  select
    g.id,
    pos.i,
    public.broki_jtxt(r.row_data, array['trabajador_' || pos.i, 'TRABAJADOR_' || pos.i])
  from public.broki_legacy_rows r
  join public.broki_planner_groups g
    on g.source_system = r.source_system and g.external_id = r.external_id
  cross join generate_series(1, 10) as pos(i)
  where r.source_table = 'grupo_trabajo'
    and public.broki_jtxt(r.row_data, array['trabajador_' || pos.i, 'TRABAJADOR_' || pos.i]) is not null;

  return n;
end;
$$;

create or replace function public.broki_normalize_planner_tasks()
returns integer
language plpgsql
as $$
declare n integer;
begin
  insert into public.broki_planner_tasks (
    source_system, source_table, external_id, legacy_id,
    tipo_tarea, codigo, matricula_avion, prioridad, descripcion, notas,
    estado, fecha, fecha_modificacion, raw_payload, synced_at
  )
  select
    r.source_system,
    'pro.tareas',
    r.external_id,
    public.broki_jbigint(r.row_data, array['id', 'ID']),
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

create or replace function public.broki_normalize_tooling_movements()
returns integer
language plpgsql
as $$
declare n integer;
begin
  insert into public.broki_tooling_movements (
    source_system, source_table, external_id, legacy_id,
    bac_bact, descripcion, tma_out, complete_out, date_out,
    tma_in, complete_in, date_in, remarks, avion,
    raw_payload, synced_at
  )
  select
    r.source_system,
    'pro.tool_control',
    r.external_id,
    public.broki_jbigint(r.row_data, array['id', 'ID']),
    public.broki_jtxt(r.row_data, array['bac_bact', 'BAC_BACT', 'bac', 'BAC']),
    public.broki_jtxt(r.row_data, array['descripcion', 'DESCRIPCION']),
    public.broki_jtxt(r.row_data, array['tma_out', 'TMA_OUT']),
    public.broki_jtxt(r.row_data, array['complete_out', 'COMPLETE_OUT']),
    public.broki_jtimestamptz(r.row_data, array['date_out', 'DATE_OUT']),
    public.broki_jtxt(r.row_data, array['tma_in', 'TMA_IN']),
    public.broki_jtxt(r.row_data, array['complete_in', 'COMPLETE_IN']),
    public.broki_jtimestamptz(r.row_data, array['date_in', 'DATE_IN']),
    public.broki_jtxt(r.row_data, array['remarks', 'REMARKS']),
    public.broki_jtxt(r.row_data, array['avion', 'AVION']),
    r.row_data,
    r.synced_at
  from public.broki_legacy_rows r
  where r.source_table = 'tool_control'
  on conflict (source_system, external_id) do update set
    legacy_id = excluded.legacy_id,
    bac_bact = excluded.bac_bact,
    descripcion = excluded.descripcion,
    tma_out = excluded.tma_out,
    complete_out = excluded.complete_out,
    date_out = excluded.date_out,
    tma_in = excluded.tma_in,
    complete_in = excluded.complete_in,
    date_in = excluded.date_in,
    remarks = excluded.remarks,
    avion = excluded.avion,
    raw_payload = excluded.raw_payload,
    synced_at = excluded.synced_at;

  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.broki_normalize_communications()
returns integer
language plpgsql
as $$
declare n integer;
begin
  insert into public.broki_communications (
    source_system, source_table, external_id, legacy_id,
    id_chat, telefono, mensaje_in, mensaje_out, respondido,
    fecha_mensaje_in, fecha_mensaje_out, raw_payload, synced_at
  )
  select
    r.source_system,
    'pro.registro_comunicaciones',
    r.external_id,
    public.broki_jbigint(r.row_data, array['id', 'ID']),
    coalesce(public.broki_jtxt(r.row_data, array['id_chat', 'ID_CHAT']), r.external_id),
    coalesce(public.broki_jtxt(r.row_data, array['telefono', 'TELEFONO']), ''),
    public.broki_jtxt(r.row_data, array['mensaje_in', 'MENSAJE_IN']),
    public.broki_jtxt(r.row_data, array['mensaje_out', 'MENSAJE_OUT']),
    public.broki_jbool(r.row_data, array['respondido', 'RESPONDIDO']),
    public.broki_jtimestamptz(r.row_data, array['fecha_mensaje_in', 'FECHA_MENSAJE_IN']),
    public.broki_jtimestamptz(r.row_data, array['fecha_mensaje_out', 'FECHA_MENSAJE_OUT']),
    r.row_data,
    r.synced_at
  from public.broki_legacy_rows r
  where r.source_table = 'registro_comunicaciones'
  on conflict (source_system, external_id) do update set
    legacy_id = excluded.legacy_id,
    id_chat = excluded.id_chat,
    telefono = excluded.telefono,
    mensaje_in = excluded.mensaje_in,
    mensaje_out = excluded.mensaje_out,
    respondido = excluded.respondido,
    fecha_mensaje_in = excluded.fecha_mensaje_in,
    fecha_mensaje_out = excluded.fecha_mensaje_out,
    raw_payload = excluded.raw_payload,
    synced_at = excluded.synced_at;

  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.broki_normalize_chat_histories()
returns integer
language plpgsql
as $$
declare n integer;
begin
  insert into public.broki_chat_histories (
    source_system, source_table, external_id, legacy_id,
    session_id, role, content, message, raw_payload, synced_at
  )
  select
    r.source_system,
    'pro.n8n_chat_histories',
    r.external_id,
    public.broki_jbigint(r.row_data, array['id', 'ID']),
    coalesce(
      public.broki_jtxt(r.row_data, array['session_id', 'SESSION_ID']),
      r.external_id
    ),
    public.broki_jtxt(r.row_data, array['role', 'ROLE']),
    public.broki_jtxt(r.row_data, array['content', 'CONTENT', 'message', 'MESSAGE']),
    case
      when r.row_data ? 'message' then r.row_data->'message'
      when r.row_data ? 'MESSAGE' then r.row_data->'MESSAGE'
      else null
    end,
    r.row_data,
    r.synced_at
  from public.broki_legacy_rows r
  where r.source_table = 'n8n_chat_histories'
  on conflict (source_system, external_id) do update set
    legacy_id = excluded.legacy_id,
    session_id = excluded.session_id,
    role = excluded.role,
    content = excluded.content,
    message = excluded.message,
    raw_payload = excluded.raw_payload,
    synced_at = excluded.synced_at;

  get diagnostics n = row_count;
  return n;
end;
$$;

-- ponytail: naive text-match FK linking; ceiling = ambiguous names collide
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
  from public.broki_legacy_rows r
  join public.broki_planner_groups g
    on g.source_system = r.source_system
    and g.external_id = public.broki_jtxt(r.row_data, array['id_grupo_trabajo', 'ID_GRUPO_TRABAJO'])
  where t.group_id is null
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

create or replace function public.broki_normalize_legacy_all()
returns table(step text, rows_affected integer)
language plpgsql
as $$
begin
  step := 'personnel'; rows_affected := public.broki_normalize_personnel(); return next;
  step := 'aircraft'; rows_affected := public.broki_normalize_aircraft(); return next;
  step := 'assets'; rows_affected := public.broki_normalize_assets(); return next;
  step := 'unknown_contacts'; rows_affected := public.broki_normalize_unknown_contacts(); return next;
  step := 'tooling_catalog'; rows_affected := public.broki_normalize_tooling_catalog(); return next;
  step := 'nitro_stock'; rows_affected := public.broki_normalize_nitro_stock(); return next;
  step := 'incidents'; rows_affected := public.broki_normalize_incidents(); return next;
  step := 'planner_groups'; rows_affected := public.broki_normalize_planner_groups(); return next;
  step := 'planner_tasks'; rows_affected := public.broki_normalize_planner_tasks(); return next;
  step := 'tooling_movements'; rows_affected := public.broki_normalize_tooling_movements(); return next;
  step := 'communications'; rows_affected := public.broki_normalize_communications(); return next;
  step := 'chat_histories'; rows_affected := public.broki_normalize_chat_histories(); return next;
  perform public.broki_normalize_legacy_links();
  step := 'legacy_links'; rows_affected := 0; return next;
end;
$$;

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
    (select count(*) from broki_legacy_rows where source_table = 'nitro_stock'),
    (select count(*) from broki_nitro_stock);
$$;

grant execute on function public.broki_normalize_legacy_all() to service_role;
grant execute on function public.broki_normalize_legacy_validate() to service_role;
