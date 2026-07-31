-- BROKI operational extensions.
-- Adds the canonical tables for the features that still lived outside Postgres:
-- shift relays (were browser localStorage), the roster (was a hardcoded array in
-- the frontend) and the planner/roster PDF import runs (were n8n multipart proxies).

-- -----------------------------------------------------------------------------
-- Fleet relays. Replaces the `relays_db` localStorage key used by the legacy
-- dashboard and web/src/app/broki/(dashboard)/fleet/page.tsx.
-- -----------------------------------------------------------------------------

create table if not exists public.broki_relays (
  id uuid primary key default gen_random_uuid(),

  plane_text text not null,
  aircraft_id uuid references public.broki_aircraft(id) on delete set null,
  worker_text text,
  worker_id uuid references public.broki_personnel(id) on delete set null,
  relay_at timestamptz not null default now(),

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists broki_relays_relay_at_idx on public.broki_relays (relay_at desc);
create index if not exists broki_relays_plane_idx on public.broki_relays (plane_text);

create trigger set_broki_relays_updated_at
before update on public.broki_relays
for each row execute function public.set_updated_at();

create table if not exists public.broki_relay_points (
  id uuid primary key default gen_random_uuid(),
  relay_id uuid not null references public.broki_relays(id) on delete cascade,
  position smallint not null check (position > 0),
  point_text text not null,
  created_at timestamptz not null default now(),
  constraint broki_relay_points_unique unique (relay_id, position)
);

create index if not exists broki_relay_points_relay_idx on public.broki_relay_points (relay_id);

-- -----------------------------------------------------------------------------
-- Roster. One import run per uploaded PDF; file_hash makes re-uploading the same
-- document idempotent instead of duplicating a whole week of shifts.
-- -----------------------------------------------------------------------------

create table if not exists public.broki_roster_import_runs (
  id uuid primary key default gen_random_uuid(),
  file_hash text not null,
  file_name text,
  status text not null default 'started' check (status in ('started', 'success', 'partial', 'failed')),
  imported_count integer not null default 0,
  skipped_count integer not null default 0,
  error_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint broki_roster_import_runs_file_hash_unique unique (file_hash)
);

create table if not exists public.broki_roster_periods (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid references public.broki_roster_import_runs(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  created_at timestamptz not null default now(),
  constraint broki_roster_periods_unique unique (import_run_id, week_start)
);

create index if not exists broki_roster_periods_week_idx on public.broki_roster_periods (week_start desc);

create table if not exists public.broki_roster_assignments (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.broki_roster_periods(id) on delete cascade,
  personnel_id uuid references public.broki_personnel(id) on delete set null,

  employee_code text,
  employee_name text not null,
  cert_text text,
  airline_team text,

  -- 0 = Monday of week_start, 6 = Sunday.
  day_index smallint not null check (day_index between 0 and 6),
  shift_code text not null,
  shift_start time,
  shift_end time,

  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broki_roster_assignments_unique unique (period_id, employee_name, day_index)
);

create index if not exists broki_roster_assignments_period_idx on public.broki_roster_assignments (period_id);
create index if not exists broki_roster_assignments_personnel_idx on public.broki_roster_assignments (personnel_id);
create index if not exists broki_roster_assignments_code_idx on public.broki_roster_assignments (employee_code);

create trigger set_broki_roster_assignments_updated_at
before update on public.broki_roster_assignments
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Planner PDF imports. Same idempotency contract as the roster: the file hash is
-- unique, so the second upload of a work sheet reports duplicates instead of
-- inserting the tasks twice.
-- -----------------------------------------------------------------------------

create table if not exists public.broki_planner_import_runs (
  id uuid primary key default gen_random_uuid(),
  file_hash text not null,
  file_name text,
  status text not null default 'started' check (status in ('started', 'success', 'partial', 'failed')),
  created_count integer not null default 0,
  duplicate_count integer not null default 0,
  skipped_count integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint broki_planner_import_runs_file_hash_unique unique (file_hash)
);

create index if not exists broki_planner_import_runs_created_idx
on public.broki_planner_import_runs (created_at desc);

alter table public.broki_planner_groups
  add column if not exists import_run_id uuid references public.broki_planner_import_runs(id) on delete set null;

alter table public.broki_planner_tasks
  add column if not exists import_run_id uuid references public.broki_planner_import_runs(id) on delete set null;

create index if not exists broki_planner_groups_import_run_idx
on public.broki_planner_groups (import_run_id);
create index if not exists broki_planner_tasks_import_run_idx
on public.broki_planner_tasks (import_run_id);

-- Dedup guard for imported tasks: the same aircraft + task code + day cannot be
-- inserted twice, whichever import run produced it.
--
-- The day is taken at UTC on purpose. `fecha` is a timestamptz and a plain
-- `fecha::date` depends on the session TimeZone, which makes it STABLE rather
-- than IMMUTABLE and is rejected in an index expression. The importer writes the
-- date parsed from the sheet as UTC midnight, so pinning the zone here matches
-- what it stores and keeps the day stable regardless of who runs the query.
--
-- Production may already contain duplicates from legacy imports; keep the newest
-- row per (aircraft, code, UTC day) before the unique index is created.
delete from public.broki_planner_tasks t
using (
  select id,
    row_number() over (
      partition by
        upper(regexp_replace(coalesce(matricula_avion, ''), '[^A-Za-z0-9]', '', 'g')),
        codigo,
        ((fecha at time zone 'UTC')::date)
      order by created_at desc nulls last, id desc
    ) as rn
  from public.broki_planner_tasks
  where codigo is not null and fecha is not null
) d
where t.id = d.id and d.rn > 1;

create unique index if not exists broki_planner_tasks_dedup_idx
on public.broki_planner_tasks (
  upper(regexp_replace(coalesce(matricula_avion, ''), '[^A-Za-z0-9]', '', 'g')),
  codigo,
  ((fecha at time zone 'UTC')::date)
)
where codigo is not null and fecha is not null;

-- -----------------------------------------------------------------------------
-- Incident messages. The legacy dashboard appended chat-style messages to a
-- single incident; storing them as an opaque raw_payload blob loses ordering and
-- makes concurrent appends clobber each other.
-- -----------------------------------------------------------------------------

create table if not exists public.broki_incident_messages (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.broki_incidents(id) on delete cascade,
  author_text text,
  author_id uuid references public.broki_personnel(id) on delete set null,
  message_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists broki_incident_messages_incident_idx
on public.broki_incident_messages (incident_id, created_at);

-- Backfill from the JSONB blob so existing incidents keep their history.
insert into public.broki_incident_messages (incident_id, author_text, message_text, created_at)
select
  i.id,
  nullif(m ->> 'user', ''),
  coalesce(nullif(m ->> 'text', ''), 'Incidencia'),
  coalesce((m ->> 'time')::timestamptz, i.fecha_apertura, i.created_at)
from public.broki_incidents i
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(i.raw_payload -> 'messages') = 'array' then i.raw_payload -> 'messages'
    else '[]'::jsonb
  end
) as m
where not exists (
  select 1 from public.broki_incident_messages existing where existing.incident_id = i.id
);

-- -----------------------------------------------------------------------------
-- Public registration intake state for broki_personnel.
-- Legacy registrobroki.html posted straight into pro.personal with no review
-- step. New rows land as 'pending' so an unauthenticated form cannot create an
-- active operator record.
-- -----------------------------------------------------------------------------

alter table public.broki_personnel
  add column if not exists review_status text
  check (review_status in ('pending', 'approved', 'rejected'));

alter table public.broki_personnel
  add column if not exists departamento text;

create index if not exists broki_personnel_review_status_idx
on public.broki_personnel (review_status);

create index if not exists broki_personnel_correo_idx on public.broki_personnel (lower(correo));

-- -----------------------------------------------------------------------------
-- RLS: same contract as the core schema — authenticated can read, writes go
-- through Edge Functions with the service role.
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'broki_relays',
    'broki_relay_points',
    'broki_roster_import_runs',
    'broki_roster_periods',
    'broki_roster_assignments',
    'broki_planner_import_runs',
    'broki_incident_messages'
  ] loop
    execute format('alter table public.%I enable row level security', t);

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = t
        and policyname = 'Authenticated users can read'
    ) then
      execute format(
        'create policy "Authenticated users can read" on public.%I for select to authenticated using (true)',
        t
      );
    end if;
  end loop;
end;
$$;
