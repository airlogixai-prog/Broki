-- One open incident per equipment, enforced in the database.
-- A partial unique index would fail on legacy rows that already hold several
-- open incidents for one asset, so this uses a per-asset advisory lock in a
-- BEFORE INSERT trigger: concurrent opens for the same id_objeto serialize and
-- the second one raises `incident_already_open` (mapped to 409 by the EF).
-- Legacy duplicates are left untouched; only new inserts are guarded.

create or replace function public.broki_guard_single_open_incident()
returns trigger
language plpgsql
as $$
begin
  if new.estado = 1 and new.id_objeto is not null then
    perform pg_advisory_xact_lock(hashtext('broki_incident_open:' || new.id_objeto));
    if exists (
      select 1 from public.broki_incidents
      where id_objeto = new.id_objeto and estado = 1
    ) then
      raise exception 'incident_already_open' using errcode = 'unique_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists broki_incidents_single_open on public.broki_incidents;
create trigger broki_incidents_single_open
before insert on public.broki_incidents
for each row execute function public.broki_guard_single_open_incident();
