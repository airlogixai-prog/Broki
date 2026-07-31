-- Seed data for local development and QA fixtures.
-- Enough rows to exercise every dashboard route without importing legacy data.
-- Idempotent: `supabase db reset` replays it from scratch, and re-running it by
-- hand does not duplicate rows.

-- -----------------------------------------------------------------------------
-- Aircraft
-- -----------------------------------------------------------------------------

insert into public.broki_aircraft (source_system, source_table, external_id, matricula, aerolinea, modelo)
values
  ('seed', 'seed', 'seed-ec-nfp', 'EC-NFP', 'Iberojet', 'Airbus A330'),
  ('seed', 'seed', 'seed-ec-obm', 'EC-OBM', 'World2Fly', 'Airbus A350'),
  ('seed', 'seed', 'seed-ec-mkn', 'EC-MKN', 'Iberojet', 'Airbus A320 Family')
on conflict (source_system, external_id) do nothing;

-- -----------------------------------------------------------------------------
-- Personnel
-- -----------------------------------------------------------------------------

insert into public.broki_personnel (
  source_system, source_table, external_id, nombre, cod_empleado_aena, telefono, correo,
  estado, helper, cat_a, b1, b2, certificador, n_bac, review_status,
  b1_airbus_a330, b1_airbus_a350, a_a320_family
)
values
  ('seed', 'seed', 'seed-p-241', 'Mario Lorenzo', '241', '+34600000241', 'mario.lorenzo@example.test',
   1, false, false, true, true, false, 'BAC-241', 'approved', 1, 1, null),
  ('seed', 'seed', 'seed-p-265', 'Enrique Garcia', '265', '+34600000265', 'enrique.garcia@example.test',
   1, false, false, true, false, false, 'BAC-265', 'approved', 1, null, null),
  ('seed', 'seed', 'seed-p-424', 'Enrique Aguado', 'A-424', '+34600000424', 'enrique.aguado@example.test',
   1, false, true, false, false, false, 'BAC-424', 'approved', null, null, 1),
  ('seed', 'seed', 'seed-p-999', 'Helper Seed', '999', '+34600000999', 'helper.seed@example.test',
   1, true, false, false, false, false, null, 'approved', null, null, null)
on conflict (source_system, external_id) do nothing;

-- -----------------------------------------------------------------------------
-- Assets: 2 vans + 3 GSE (one nitrogen unit with bottles, one inoperative)
-- -----------------------------------------------------------------------------

insert into public.broki_assets (
  source_system, source_table, external_id, asset_kind, identifier, descripcion, familia,
  matricula, plazas, estado, parking, ubicacion_habitual, avion_text, current_worker_text,
  combustible, adblue, notas, nitrogeno_1, nitrogeno_2, nitrogeno_3, nitrogeno_4
)
values
  ('seed', 'seed', 'seed-a-furgo-01', 'van', 'FURGO-01', 'Furgoneta Mantenimiento', 'FURGONETA',
   '1234-ABC', '5', 'Disponible', null, 'BASE', null, null, 82, 60, null, null, null, null, null),
  ('seed', 'seed', 'seed-a-furgo-02', 'van', 'FURGO-02', 'Furgoneta Linea', 'FURGONETA',
   '5678-DEF', '3', 'En Uso', '520', 'BASE', 'EC-NFP', 'Mario Lorenzo', 18, 45, 'Nivel bajo de combustible', null, null, null, null),
  ('seed', 'seed', 'seed-a-gse-n2', 'nitro', 'N2-01', 'Carro Nitrogeno', 'NITROGENO',
   null, null, 'En Uso', '542', 'T4S', 'EC-OBM', 'Enrique Garcia', null, null, null, 2400, 1900, 700, 0),
  ('seed', 'seed', 'seed-a-gse-gpu', 'gse', 'GPU-01', 'GPU Generador', 'GSE',
   null, null, 'Disponible', null, 'T4', null, null, 55, null, null, null, null, null, null),
  ('seed', 'seed', 'seed-a-gse-esc', 'gse', 'E-07', 'Escalera Pasajeros', 'GSE',
   null, null, 'Inoperativo', '305', 'T4', null, null, null, null, 'Pendiente de revision', null, null, null, null)
on conflict (source_system, source_table, external_id) do nothing;

-- -----------------------------------------------------------------------------
-- Incidents: one open (with two messages), one closed
-- -----------------------------------------------------------------------------

insert into public.broki_incidents (
  source_system, source_table, external_id, incident_code, id_objeto, asset_id,
  descripcion, estado, status_text, trabajador_text, fecha_apertura, fecha_cierre
)
select
  'seed', 'seed', 'seed-i-open', 'E-07-001', 'E-07', a.id,
  'Hidraulico pierde presion', 1, 'abierta', 'Enrique Garcia', now() - interval '2 days', null
from public.broki_assets a
where a.external_id = 'seed-a-gse-esc'
on conflict (source_system, external_id) do nothing;

insert into public.broki_incidents (
  source_system, source_table, external_id, incident_code, id_objeto, asset_id,
  descripcion, estado, status_text, trabajador_text, fecha_apertura, fecha_cierre
)
select
  'seed', 'seed', 'seed-i-closed', 'FURGO-02-001', 'FURGO-02', a.id,
  'Testigo AdBlue encendido', 0, 'cerrada', 'Mario Lorenzo', now() - interval '9 days', now() - interval '7 days'
from public.broki_assets a
where a.external_id = 'seed-a-furgo-02'
on conflict (source_system, external_id) do nothing;

insert into public.broki_incident_messages (incident_id, author_text, message_text, created_at)
select i.id, 'Enrique Garcia', 'Detectada fuga en el circuito hidraulico.', now() - interval '2 days'
from public.broki_incidents i
where i.external_id = 'seed-i-open'
  and not exists (select 1 from public.broki_incident_messages m where m.incident_id = i.id);

insert into public.broki_incident_messages (incident_id, author_text, message_text, created_at)
select i.id, 'Taller', 'Pedido recambio, pendiente de entrega.', now() - interval '1 day'
from public.broki_incidents i
where i.external_id = 'seed-i-open'
  and (select count(*) from public.broki_incident_messages m where m.incident_id = i.id) = 1;

insert into public.broki_incident_messages (incident_id, author_text, message_text, created_at)
select i.id, 'Mario Lorenzo', 'Rellenado AdBlue, testigo apagado.', now() - interval '7 days'
from public.broki_incidents i
where i.external_id = 'seed-i-closed'
  and not exists (select 1 from public.broki_incident_messages m where m.incident_id = i.id);

-- -----------------------------------------------------------------------------
-- Nitrogen stock aggregated per location
-- -----------------------------------------------------------------------------

insert into public.broki_nitro_stock (source_system, source_table, external_id, ubicacion, botellas_llenas, botellas_vacias)
values
  ('seed', 'seed', 'seed-stock-t4s', 't4s', 14, 6),
  ('seed', 'seed', 'seed-stock-t123', 't1,2,3', 9, 11)
on conflict (source_system, external_id) do nothing;

-- -----------------------------------------------------------------------------
-- Tooling: catalog plus one open checkout and one returned movement
-- -----------------------------------------------------------------------------

-- catalogToLegacyRow() maps familia -> tipo_tool, codigo -> part_number and reads
-- ubicacion_habitual / serial_number / rango out of raw_payload.
insert into public.broki_tooling_catalog (
  source_system, source_table, external_id, bac_bact, descripcion, familia, codigo, estado, raw_payload
)
values
  ('seed', 'seed', 'seed-t-1001', 'BAC-1001', 'Llave dinamometrica 1/2', 'BAC', 'PN-1001', 'Disponible',
   '{"ubicacion_habitual": "Taller T4S", "serial_number": "SN-1001", "rango": "20-100 Nm"}'::jsonb),
  ('seed', 'seed', 'seed-t-1002', 'BAC-1002', 'Gato hidraulico 20T', 'BAC', 'PN-1002', 'Disponible',
   '{"ubicacion_habitual": "Taller T4S", "serial_number": "SN-1002", "rango": "20T"}'::jsonb),
  ('seed', 'seed', 'seed-t-2001', 'BACT-2001', 'Calibrador presion neumaticos', 'BACT', 'PN-2001', 'Disponible',
   '{"ubicacion_habitual": "Taller T4", "serial_number": "SN-2001", "rango": "0-15 bar"}'::jsonb)
on conflict (source_system, external_id) do nothing;

insert into public.broki_tooling_movements (
  source_system, source_table, external_id, bac_bact, tool_id, descripcion,
  tma_out, complete_out, date_out, avion, remarks
)
select
  'seed', 'seed', 'seed-m-open', 'BAC-1002', c.id, 'Gato hidraulico 20T',
  'Mario Lorenzo', 'Completo', now() - interval '3 hours', 'EC-NFP', 'Salida para cambio de rueda'
from public.broki_tooling_catalog c
where c.external_id = 'seed-t-1002'
on conflict (source_system, external_id) do nothing;

insert into public.broki_tooling_movements (
  source_system, source_table, external_id, bac_bact, tool_id, descripcion,
  tma_out, complete_out, date_out, avion, remarks, tma_in, complete_in, date_in
)
select
  'seed', 'seed', 'seed-m-closed', 'BAC-1001', c.id, 'Llave dinamometrica 1/2',
  'Enrique Garcia', 'Completo', now() - interval '2 days', 'EC-MKN', 'Salida rutina',
  'Enrique Garcia', 'Completo', now() - interval '1 day'
from public.broki_tooling_catalog c
where c.external_id = 'seed-t-1001'
on conflict (source_system, external_id) do nothing;

-- -----------------------------------------------------------------------------
-- Planner: one group for today with members and tasks
-- -----------------------------------------------------------------------------

insert into public.broki_planner_groups (
  source_system, source_table, external_id, id_avion, modelo, aerolinea,
  vehiculo, responsable, hora_salida, fecha_modificacion
)
values (
  'seed', 'seed', 'seed-group-ecnfp', 'EC-NFP', 'Airbus A330', 'Iberojet',
  'FURGO-02', 'Mario Lorenzo', date_trunc('day', now()) + interval '18 hours', now()
)
on conflict (source_system, external_id) do nothing;

insert into public.broki_planner_group_members (group_id, position, worker_text)
select g.id, v.position, v.worker_text
from public.broki_planner_groups g
cross join (values (1, 'Mario Lorenzo'), (2, 'Enrique Garcia'), (3, 'Helper Seed')) as v(position, worker_text)
where g.external_id = 'seed-group-ecnfp'
on conflict (group_id, position) do nothing;

insert into public.broki_planner_tasks (
  source_system, source_table, external_id, group_id, tipo_tarea, codigo,
  matricula_avion, prioridad, descripcion, estado, fecha
)
select
  'seed', 'seed', v.external_id, g.id, v.tipo_tarea, v.codigo,
  'EC-NFP', v.prioridad, v.descripcion, v.estado, date_trunc('day', now()) + interval '9 hours'
from public.broki_planner_groups g
cross join (values
  ('seed-task-1', 'MEL', 'MEL-2201', 'NO_GO', 'Revisar luz de posicion ala derecha', 0),
  ('seed-task-2', 'PREVUELO', 'PRE-0455', 'NORMAL', 'Inspeccion prevuelo completa', 1),
  ('seed-task-3', 'SERVICIO', 'SRV-0912', 'CRITICAL', 'Carga de nitrogeno tren principal', 0)
) as v(external_id, tipo_tarea, codigo, prioridad, descripcion, estado)
where g.external_id = 'seed-group-ecnfp'
on conflict (source_system, external_id) do nothing;

-- -----------------------------------------------------------------------------
-- Roster: one imported week
-- -----------------------------------------------------------------------------

insert into public.broki_roster_import_runs (file_hash, file_name, status, imported_count)
values ('seed-roster-hash', 'seed-roster.pdf', 'success', 21)
on conflict (file_hash) do nothing;

insert into public.broki_roster_periods (import_run_id, week_start, week_end)
select r.id,
       (date_trunc('week', now()))::date,
       (date_trunc('week', now()) + interval '6 days')::date
from public.broki_roster_import_runs r
where r.file_hash = 'seed-roster-hash'
on conflict (import_run_id, week_start) do nothing;

insert into public.broki_roster_assignments (
  period_id, employee_code, employee_name, cert_text, airline_team, day_index, shift_code, shift_start, shift_end
)
select p.id, v.code, v.name, v.cert, v.team, v.day_index, v.shift, v.shift_start, v.shift_end
from public.broki_roster_periods p
join public.broki_roster_import_runs r on r.id = p.import_run_id and r.file_hash = 'seed-roster-hash'
cross join (values
  ('241', 'Mario Lorenzo',  'B1, B2', 'iberojet', 0, '07:00-19:00', time '07:00', time '19:00'),
  ('241', 'Mario Lorenzo',  'B1, B2', 'iberojet', 1, '07:00-19:00', time '07:00', time '19:00'),
  ('241', 'Mario Lorenzo',  'B1, B2', 'iberojet', 2, 'L',           null,         null),
  ('241', 'Mario Lorenzo',  'B1, B2', 'iberojet', 3, 'L',           null,         null),
  ('241', 'Mario Lorenzo',  'B1, B2', 'iberojet', 4, '07:00-18:00', time '07:00', time '18:00'),
  ('241', 'Mario Lorenzo',  'B1, B2', 'iberojet', 5, '07:00-18:00', time '07:00', time '18:00'),
  ('241', 'Mario Lorenzo',  'B1, B2', 'iberojet', 6, 'V',           null,         null),
  ('265', 'Enrique Garcia', 'B1',     'w2f',      0, '07:00-17:00', time '07:00', time '17:00'),
  ('265', 'Enrique Garcia', 'B1',     'w2f',      1, '07:00-17:00', time '07:00', time '17:00'),
  ('265', 'Enrique Garcia', 'B1',     'w2f',      2, '06:00-16:00', time '06:00', time '16:00'),
  ('265', 'Enrique Garcia', 'B1',     'w2f',      3, '08:00-16:00', time '08:00', time '16:00'),
  ('265', 'Enrique Garcia', 'B1',     'w2f',      4, 'L',           null,         null),
  ('265', 'Enrique Garcia', 'B1',     'w2f',      5, 'L',           null,         null),
  ('265', 'Enrique Garcia', 'B1',     'w2f',      6, 'L',           null,         null),
  ('A-424', 'Enrique Aguado', 'CAT A', 'iberojet', 0, '10:00-18:00', time '10:00', time '18:00'),
  ('A-424', 'Enrique Aguado', 'CAT A', 'iberojet', 1, '09:00-17:00', time '09:00', time '17:00'),
  ('A-424', 'Enrique Aguado', 'CAT A', 'iberojet', 2, 'L',           null,         null),
  ('A-424', 'Enrique Aguado', 'CAT A', 'iberojet', 3, 'FS',          null,         null),
  ('A-424', 'Enrique Aguado', 'CAT A', 'iberojet', 4, 'L',          null,         null),
  ('A-424', 'Enrique Aguado', 'CAT A', 'iberojet', 5, 'L',          null,         null),
  ('A-424', 'Enrique Aguado', 'CAT A', 'iberojet', 6, '09:00-19:00', time '09:00', time '19:00')
) as v(code, name, cert, team, day_index, shift, shift_start, shift_end)
on conflict (period_id, employee_name, day_index) do nothing;

update public.broki_roster_assignments a
set personnel_id = p.id
from public.broki_personnel p
where a.personnel_id is null and p.cod_empleado_aena = a.employee_code;

-- -----------------------------------------------------------------------------
-- Fleet relays
-- -----------------------------------------------------------------------------

insert into public.broki_relays (id, plane_text, worker_text, relay_at)
values ('11111111-1111-4111-8111-111111111111', 'EC-NFP', 'Mario Lorenzo', now() - interval '4 hours')
on conflict (id) do nothing;

insert into public.broki_relay_points (relay_id, position, point_text)
values
  ('11111111-1111-4111-8111-111111111111', 1, 'Pendiente cambio de rueda tren principal derecho.'),
  ('11111111-1111-4111-8111-111111111111', 2, 'MEL-2201 abierta, esperando recambio.')
on conflict (relay_id, position) do nothing;
