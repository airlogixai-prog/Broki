-- Fase 12.2: FKs after relation backfill (nullable; historical nulls allowed).

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'broki_personnel_auth_user_id_fkey'
  ) then
    alter table public.broki_personnel
      add constraint broki_personnel_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'broki_incidents_aircraft_id_fkey'
  ) then
    alter table public.broki_incidents
      add constraint broki_incidents_aircraft_id_fkey
      foreign key (aircraft_id) references public.broki_aircraft(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'broki_incidents_planner_task_id_fkey'
  ) then
    alter table public.broki_incidents
      add constraint broki_incidents_planner_task_id_fkey
      foreign key (planner_task_id) references public.broki_planner_tasks(id) on delete set null;
  end if;
end $$;

create index if not exists broki_personnel_auth_user_idx
  on public.broki_personnel (auth_user_id)
  where auth_user_id is not null;

create index if not exists broki_incidents_aircraft_idx
  on public.broki_incidents (aircraft_id)
  where aircraft_id is not null;

create index if not exists broki_incidents_planner_task_idx
  on public.broki_incidents (planner_task_id)
  where planner_task_id is not null;
