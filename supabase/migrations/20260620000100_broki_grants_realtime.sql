-- Canonical privileges and Realtime publication for BROKI.
--
-- Replaces the grants that used to live in 20260617211634_remote_schema.sql, which
-- ran before the tables existed. Two things change versus that file:
--   1. `anon` loses insert/update/delete on every operational table. Public traffic
--      (the /registrobroki form) writes through an Edge Function with the service
--      role, never straight from the browser.
--   2. Tables the dashboard subscribes to are added to `supabase_realtime`, so
--      external changes reach the UI without waiting for the 30s polling fallback.

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
  operational text[] := array[
    'broki_sync_runs',
    'broki_sync_errors',
    'broki_audit_events',
    'broki_personnel',
    'broki_aircraft',
    'broki_assets',
    'broki_asset_aliases',
    'broki_incidents',
    'broki_incident_messages',
    'broki_planner_groups',
    'broki_planner_group_members',
    'broki_planner_tasks',
    'broki_planner_import_runs',
    'broki_nitro_stock',
    'broki_tooling_catalog',
    'broki_tooling_movements',
    'broki_communications',
    'broki_chat_histories',
    'broki_unknown_contacts',
    'broki_legacy_rows',
    'broki_legacy_table_snapshots',
    'broki_legacy_import_errors',
    'broki_relays',
    'broki_relay_points',
    'broki_roster_import_runs',
    'broki_roster_periods',
    'broki_roster_assignments'
  ];
begin
  foreach t in array operational loop
    if to_regclass(format('public.%I', t)) is null then
      raise warning 'skipping grants for missing table public.%', t;
      continue;
    end if;

    -- anon: no access at all to operational data. RLS already denies reads, but
    -- revoking the privilege means a future policy mistake cannot expose writes.
    execute format('revoke all on table public.%I from anon', t);

    -- authenticated: read only. Every mutation goes through an Edge Function.
    execute format('revoke all on table public.%I from authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);

    execute format('grant all on table public.%I to service_role', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Realtime publication
-- Only the tables the frontend actually subscribes to.
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
  realtime_tables text[] := array[
    'broki_assets',
    'broki_incidents',
    'broki_incident_messages',
    'broki_nitro_stock',
    'broki_tooling_movements',
    'broki_planner_groups',
    'broki_planner_tasks',
    'broki_roster_assignments',
    'broki_relays'
  ];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise warning 'publication supabase_realtime not found; skipping Realtime setup';
    return;
  end if;

  foreach t in array realtime_tables loop
    if to_regclass(format('public.%I', t)) is null then
      raise warning 'skipping Realtime for missing table public.%', t;
      continue;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- Realtime payloads for updates need the full old row to diff reliably.
do $$
declare
  t text;
begin
  foreach t in array array['broki_assets', 'broki_incidents', 'broki_nitro_stock'] loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I replica identity full', t);
    end if;
  end loop;
end;
$$;
