-- BROKI core schema for Supabase
-- Purpose: create canonical, linked tables before populating from n8n/Postgres legacy workflows.
-- Source workflows inspected:
-- - PRODUCCION_REGISTROS_DASHBOARD
-- - PRODUCCION_FLUJO_PRINCIPAL

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Generic helpers
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Sync/audit layer: every import run should write here.
-- -----------------------------------------------------------------------------

create table if not exists public.broki_sync_runs (
  id uuid primary key default gen_random_uuid(),
  entity text not null,
  source_system text not null default 'legacy_n8n_postgres',
  source_table text,
  sync_mode text not null default 'full' check (sync_mode in ('full', 'incremental', 'manual', 'webhook')),
  status text not null default 'started' check (status in ('started', 'success', 'partial', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  fetched_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  error_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.broki_sync_errors (
  id uuid primary key default gen_random_uuid(),
  sync_run_id uuid references public.broki_sync_runs(id) on delete cascade,
  entity text not null,
  source_system text not null default 'legacy_n8n_postgres',
  source_table text,
  external_id text,
  error_message text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.broki_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_personnel_id uuid,
  event_type text not null,
  entity text,
  entity_id uuid,
  source_system text,
  source_webhook text,
  status text not null default 'success' check (status in ('success', 'failed', 'blocked')),
  ip inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- People / users
-- Source examples: pro.personal, pro.no_existe_telefono, ManyChat full_data.
-- -----------------------------------------------------------------------------

create table if not exists public.broki_personnel (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'legacy_n8n_postgres',
  source_table text not null default 'pro.personal',
  external_id text not null,
  legacy_id bigint,

  nombre text not null,
  cod_empleado_aena text,
  telefono text,
  correo text,
  id_chat text,
  estado integer,
  fecha_alta date,
  fecha_baja timestamptz,
  fecha_modificacion timestamptz,

  helper boolean,
  cat_a boolean,
  b1 boolean,
  b2 boolean,
  certificador boolean,
  n_bac text,

  a_a320_family integer,
  a_airbus_a330 integer,
  a_airbus_a350 integer,
  a_boeing_737 integer,
  a_boeing_787 integer,
  a_boeing_777 integer,
  a_atr_42_72 integer,
  a_embraer_e_jet integer,
  a_bombardier_crj integer,
  a_otros integer,

  b1_a320_family integer,
  b1_airbus_a330 integer,
  b1_airbus_a350 integer,
  b1_boeing_737 integer,
  b1_boeing_787 integer,
  b1_boeing_777 integer,
  b1_atr_42_72 integer,
  b1_embraer_e_jet integer,
  b1_bombardier_crj integer,
  b1_otros integer,

  b2_a320_family integer,
  b2_airbus_a330 integer,
  b2_airbus_a350 integer,
  b2_boeing_737 integer,
  b2_boeing_787 integer,
  b2_boeing_777 integer,
  b2_atr_42_72 integer,
  b2_embraer_e_jet integer,
  b2_bombardier_crj integer,
  b2_otros integer,

  raw_payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint broki_personnel_source_external_unique unique (source_system, external_id)
);

create index if not exists broki_personnel_phone_idx on public.broki_personnel (telefono);
create index if not exists broki_personnel_aena_idx on public.broki_personnel (cod_empleado_aena);
create index if not exists broki_personnel_name_idx on public.broki_personnel using gin (to_tsvector('simple', coalesce(nombre, '')));

create trigger set_broki_personnel_updated_at
before update on public.broki_personnel
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Aircraft
-- Source: pro.aviones and planner/inventory aircraft text references.
-- -----------------------------------------------------------------------------

create table if not exists public.broki_aircraft (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'legacy_n8n_postgres',
  source_table text not null default 'pro.aviones',
  external_id text not null,
  legacy_id bigint,

  matricula text,
  modelo text,
  aerolinea text,
  estado text,
  raw_payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint broki_aircraft_source_external_unique unique (source_system, external_id)
);

create unique index if not exists broki_aircraft_matricula_unique
on public.broki_aircraft (matricula)
where matricula is not null;

create trigger set_broki_aircraft_updated_at
before update on public.broki_aircraft
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Assets: canonical table for PRO.INVENTARIO, pro.furgonetas, pro.gse and related resources.
-- Keep source_table + raw_payload so we do not lose legacy shape.
-- -----------------------------------------------------------------------------

create table if not exists public.broki_assets (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'legacy_n8n_postgres',
  source_table text not null,
  external_id text not null,
  legacy_id bigint,

  asset_kind text not null default 'other' check (asset_kind in ('van', 'gse', 'inventory', 'tooling', 'nitro', 'card', 'tablet', 'aircraft', 'other')),
  identifier text not null,
  descripcion text,
  nombre_equipo text,
  matricula text,
  familia text,
  plazas text,

  estado text,
  ubicacion_habitual text,
  parking text,
  avion_text text,
  aircraft_id uuid references public.broki_aircraft(id) on delete set null,

  current_worker_text text,
  current_worker_id uuid references public.broki_personnel(id) on delete set null,

  combustible numeric,
  adblue numeric,
  nitrogeno_1 numeric,
  nitrogeno_2 numeric,
  nitrogeno_3 numeric,
  nitrogeno_4 numeric,
  notas text,

  raw_payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint broki_assets_source_external_unique unique (source_system, source_table, external_id)
);

create index if not exists broki_assets_identifier_idx on public.broki_assets (identifier);
create index if not exists broki_assets_kind_idx on public.broki_assets (asset_kind);
create index if not exists broki_assets_state_idx on public.broki_assets (estado);
create index if not exists broki_assets_aircraft_idx on public.broki_assets (aircraft_id);
create index if not exists broki_assets_worker_idx on public.broki_assets (current_worker_id);
create index if not exists broki_assets_text_idx on public.broki_assets using gin (to_tsvector('simple', coalesce(identifier,'') || ' ' || coalesce(descripcion,'') || ' ' || coalesce(nombre_equipo,'')));

create trigger set_broki_assets_updated_at
before update on public.broki_assets
for each row execute function public.set_updated_at();

-- Optional aliases to resolve legacy free text identifiers to canonical assets.
create table if not exists public.broki_asset_aliases (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.broki_assets(id) on delete cascade,
  alias text not null,
  alias_type text default 'legacy',
  created_at timestamptz not null default now(),
  constraint broki_asset_aliases_unique unique (asset_id, alias)
);

create index if not exists broki_asset_aliases_alias_idx on public.broki_asset_aliases (alias);

-- -----------------------------------------------------------------------------
-- Incidents
-- Source: pro.incidencias; webhook fields id_incidencia, id_objeto, trabajador.
-- -----------------------------------------------------------------------------

create table if not exists public.broki_incidents (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'legacy_n8n_postgres',
  source_table text not null default 'pro.incidencias',
  external_id text not null,
  legacy_id bigint,

  incident_code text,
  id_objeto text,
  asset_id uuid references public.broki_assets(id) on delete set null,
  descripcion text,
  estado integer,
  status_text text,
  trabajador_text text,
  worker_id uuid references public.broki_personnel(id) on delete set null,
  fecha_apertura timestamptz,
  fecha_cierre timestamptz,
  fecha_modificacion timestamptz,

  raw_payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint broki_incidents_source_external_unique unique (source_system, external_id)
);

create index if not exists broki_incidents_asset_idx on public.broki_incidents (asset_id);
create index if not exists broki_incidents_worker_idx on public.broki_incidents (worker_id);
create index if not exists broki_incidents_estado_idx on public.broki_incidents (estado);
create index if not exists broki_incidents_code_idx on public.broki_incidents (incident_code);

create trigger set_broki_incidents_updated_at
before update on public.broki_incidents
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Planner groups and normalized members
-- Source: pro.grupo_trabajo with trabajador_1...trabajador_10.
-- -----------------------------------------------------------------------------

create table if not exists public.broki_planner_groups (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'legacy_n8n_postgres',
  source_table text not null default 'pro.grupo_trabajo',
  external_id text not null,
  legacy_id bigint,

  id_avion text,
  aircraft_id uuid references public.broki_aircraft(id) on delete set null,
  modelo text,
  aerolinea text,
  vehiculo text,
  vehicle_asset_id uuid references public.broki_assets(id) on delete set null,
  responsable text,
  responsible_person_id uuid references public.broki_personnel(id) on delete set null,
  hora_llegada timestamptz,
  hora_salida timestamptz,
  destino text,
  fecha_modificacion timestamptz,

  raw_payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint broki_planner_groups_source_external_unique unique (source_system, external_id)
);

create index if not exists broki_planner_groups_aircraft_idx on public.broki_planner_groups (aircraft_id);
create index if not exists broki_planner_groups_vehicle_idx on public.broki_planner_groups (vehicle_asset_id);
create index if not exists broki_planner_groups_responsible_idx on public.broki_planner_groups (responsible_person_id);

create trigger set_broki_planner_groups_updated_at
before update on public.broki_planner_groups
for each row execute function public.set_updated_at();

create table if not exists public.broki_planner_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.broki_planner_groups(id) on delete cascade,
  position smallint not null check (position between 1 and 10),
  worker_text text,
  person_id uuid references public.broki_personnel(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broki_planner_group_members_unique unique (group_id, position)
);

create index if not exists broki_planner_group_members_person_idx on public.broki_planner_group_members (person_id);

create trigger set_broki_planner_group_members_updated_at
before update on public.broki_planner_group_members
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Planner tasks
-- Source: pro.tareas.
-- -----------------------------------------------------------------------------

create table if not exists public.broki_planner_tasks (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'legacy_n8n_postgres',
  source_table text not null default 'pro.tareas',
  external_id text not null,
  legacy_id bigint,

  group_id uuid references public.broki_planner_groups(id) on delete set null,
  tipo_tarea text,
  codigo text,
  matricula_avion text,
  aircraft_id uuid references public.broki_aircraft(id) on delete set null,
  prioridad text,
  descripcion text,
  notas text,
  estado integer,
  fecha timestamptz,
  fecha_modificacion timestamptz,

  raw_payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint broki_planner_tasks_source_external_unique unique (source_system, external_id)
);

create index if not exists broki_planner_tasks_group_idx on public.broki_planner_tasks (group_id);
create index if not exists broki_planner_tasks_aircraft_idx on public.broki_planner_tasks (aircraft_id);
create index if not exists broki_planner_tasks_codigo_idx on public.broki_planner_tasks (codigo);
create index if not exists broki_planner_tasks_estado_idx on public.broki_planner_tasks (estado);

create trigger set_broki_planner_tasks_updated_at
before update on public.broki_planner_tasks
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Nitro stock
-- Source: n8n DataTable "brok node".
-- -----------------------------------------------------------------------------

create table if not exists public.broki_nitro_stock (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'n8n_datatable',
  source_table text not null default 'brok node',
  external_id text not null,

  ubicacion text not null,
  botellas_llenas integer,
  botellas_vacias integer,
  raw_payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint broki_nitro_stock_source_external_unique unique (source_system, external_id)
);

create unique index if not exists broki_nitro_stock_ubicacion_unique
on public.broki_nitro_stock (ubicacion);

create trigger set_broki_nitro_stock_updated_at
before update on public.broki_nitro_stock
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Tooling catalog and movements
-- Source: pro.tooling and pro.tool_control.
-- -----------------------------------------------------------------------------

create table if not exists public.broki_tooling_catalog (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'legacy_n8n_postgres',
  source_table text not null default 'pro.tooling',
  external_id text not null,
  legacy_id bigint,

  bac_bact text,
  codigo text,
  descripcion text,
  familia text,
  estado text,
  raw_payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint broki_tooling_catalog_source_external_unique unique (source_system, external_id)
);

create index if not exists broki_tooling_catalog_bac_idx on public.broki_tooling_catalog (bac_bact);
create index if not exists broki_tooling_catalog_text_idx on public.broki_tooling_catalog using gin (to_tsvector('simple', coalesce(bac_bact,'') || ' ' || coalesce(descripcion,'')));

create trigger set_broki_tooling_catalog_updated_at
before update on public.broki_tooling_catalog
for each row execute function public.set_updated_at();

create table if not exists public.broki_tooling_movements (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'legacy_n8n_postgres',
  source_table text not null default 'pro.tool_control',
  external_id text not null,
  legacy_id bigint,

  tool_id uuid references public.broki_tooling_catalog(id) on delete set null,
  bac_bact text,
  descripcion text,
  tma_out text,
  tma_out_person_id uuid references public.broki_personnel(id) on delete set null,
  complete_out text,
  date_out timestamptz,
  tma_in text,
  tma_in_person_id uuid references public.broki_personnel(id) on delete set null,
  complete_in text,
  date_in timestamptz,
  remarks text,
  avion text,
  aircraft_id uuid references public.broki_aircraft(id) on delete set null,

  raw_payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint broki_tooling_movements_source_external_unique unique (source_system, external_id)
);

create index if not exists broki_tooling_movements_tool_idx on public.broki_tooling_movements (tool_id);
create index if not exists broki_tooling_movements_bac_idx on public.broki_tooling_movements (bac_bact);
create index if not exists broki_tooling_movements_aircraft_idx on public.broki_tooling_movements (aircraft_id);
create index if not exists broki_tooling_movements_open_idx on public.broki_tooling_movements (date_in) where date_in is null;

create trigger set_broki_tooling_movements_updated_at
before update on public.broki_tooling_movements
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- WhatsApp / ManyChat communications and memory.
-- Source: broki_produccion_in, pro.registro_comunicaciones, pro.n8n_chat_histories.
-- -----------------------------------------------------------------------------

create table if not exists public.broki_communications (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'legacy_n8n_postgres',
  source_table text not null default 'pro.registro_comunicaciones',
  external_id text not null,
  legacy_id bigint,

  id_chat text not null,
  telefono text not null,
  person_id uuid references public.broki_personnel(id) on delete set null,
  mensaje_in text,
  mensaje_out text,
  respondido boolean,
  fecha_mensaje_in timestamptz,
  fecha_mensaje_out timestamptz,

  raw_payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint broki_communications_source_external_unique unique (source_system, external_id)
);

create index if not exists broki_communications_chat_idx on public.broki_communications (id_chat);
create index if not exists broki_communications_phone_idx on public.broki_communications (telefono);
create index if not exists broki_communications_person_idx on public.broki_communications (person_id);

create trigger set_broki_communications_updated_at
before update on public.broki_communications
for each row execute function public.set_updated_at();

create table if not exists public.broki_chat_histories (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'legacy_n8n_postgres',
  source_table text not null default 'pro.n8n_chat_histories',
  external_id text not null,
  legacy_id bigint,

  session_id text not null,
  person_id uuid references public.broki_personnel(id) on delete set null,
  role text,
  content text,
  message jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint broki_chat_histories_source_external_unique unique (source_system, external_id)
);

create index if not exists broki_chat_histories_session_idx on public.broki_chat_histories (session_id);
create index if not exists broki_chat_histories_person_idx on public.broki_chat_histories (person_id);

create trigger set_broki_chat_histories_updated_at
before update on public.broki_chat_histories
for each row execute function public.set_updated_at();

create table if not exists public.broki_unknown_contacts (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'legacy_n8n_postgres',
  source_table text not null default 'pro.no_existe_telefono',
  external_id text not null,
  legacy_id bigint,

  id_chat text,
  first_name text,
  last_name text,
  telefono text not null,
  mensaje text,
  fecha_modificacion timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint broki_unknown_contacts_source_external_unique unique (source_system, external_id)
);

create index if not exists broki_unknown_contacts_phone_idx on public.broki_unknown_contacts (telefono);

create trigger set_broki_unknown_contacts_updated_at
before update on public.broki_unknown_contacts
for each row execute function public.set_updated_at();

-- Now that personnel exists, add the FK to audit events.
alter table public.broki_audit_events
  drop constraint if exists broki_audit_events_actor_personnel_id_fkey;

alter table public.broki_audit_events
  add constraint broki_audit_events_actor_personnel_id_fkey
  foreign key (actor_personnel_id) references public.broki_personnel(id) on delete set null;

-- -----------------------------------------------------------------------------
-- RLS: read-only for authenticated users. Writes should go through Edge Functions
-- using service role or explicit server-side policies.
-- -----------------------------------------------------------------------------

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'broki_sync_runs',
    'broki_sync_errors',
    'broki_audit_events',
    'broki_personnel',
    'broki_aircraft',
    'broki_assets',
    'broki_asset_aliases',
    'broki_incidents',
    'broki_planner_groups',
    'broki_planner_group_members',
    'broki_planner_tasks',
    'broki_nitro_stock',
    'broki_tooling_catalog',
    'broki_tooling_movements',
    'broki_communications',
    'broki_chat_histories',
    'broki_unknown_contacts'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = 'Authenticated users can read'
    ) then
      execute format('create policy "Authenticated users can read" on public.%I for select to authenticated using (true)', table_name);
    end if;
  end loop;
end;
$$;
