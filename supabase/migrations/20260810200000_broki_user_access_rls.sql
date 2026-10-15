-- F20: BROKI access control + RLS least privilege (forward-only).
-- Auth.users alone is NOT authorization. Deny-by-default for dashboard.

create table if not exists public.broki_user_access (
  user_id uuid primary key references auth.users (id) on delete cascade,
  personnel_id uuid references public.broki_personnel (id) on delete set null,
  role text not null check (role in ('admin', 'operator', 'viewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  notes text
);

create index if not exists broki_user_access_active_idx
  on public.broki_user_access (user_id)
  where is_active;

create index if not exists broki_user_access_personnel_idx
  on public.broki_user_access (personnel_id)
  where personnel_id is not null;

comment on table public.broki_user_access is
  'Invite-only BROKI dashboard access. auth.users without a row here = 403.';

alter table public.broki_user_access enable row level security;

-- Users can read their own access row (UI role display); no writes from client.
drop policy if exists "broki_user_access_select_own" on public.broki_user_access;
create policy "broki_user_access_select_own"
  on public.broki_user_access
  for select
  to authenticated
  using (user_id = auth.uid());

-- Helper: active BROKI dashboard principal (security definer, stable).
create or replace function public.broki_has_dashboard_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.broki_user_access a
    where a.user_id = auth.uid()
      and a.is_active = true
  );
$$;

revoke all on function public.broki_has_dashboard_access() from public;
grant execute on function public.broki_has_dashboard_access() to authenticated, service_role;

create or replace function public.broki_dashboard_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select a.role
  from public.broki_user_access a
  where a.user_id = auth.uid()
    and a.is_active = true
  limit 1;
$$;

revoke all on function public.broki_dashboard_role() from public;
grant execute on function public.broki_dashboard_role() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Drop open "Authenticated users can read" on sensitive / ETL tables
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'broki_legacy_rows',
    'broki_legacy_table_snapshots',
    'broki_legacy_import_batches',
    'broki_legacy_import_errors',
    'broki_communications',
    'broki_chat_histories',
    'broki_unknown_contacts',
    'broki_audit_events',
    'broki_sync_runs',
    'broki_sync_errors',
    'broki_idempotency_keys',
    'broki_relation_resolutions',
    'broki_canonical_cleanup_audit',
    'broki_marketing_leads'
  ]
  loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists %I on public.%I', 'Authenticated users can read', t);
      -- No SELECT for authenticated — service_role bypasses RLS.
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Operational realtime tables: SELECT only if broki_has_dashboard_access()
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'broki_assets',
    'broki_asset_aliases',
    'broki_incidents',
    'broki_incident_messages',
    'broki_planner_groups',
    'broki_planner_group_members',
    'broki_planner_tasks',
    'broki_nitro_stock',
    'broki_tooling_catalog',
    'broki_tooling_movements',
    'broki_aircraft',
    'broki_personnel',
    'broki_relays',
    'broki_relay_points',
    'broki_roster_assignments',
    'broki_roster_periods',
    'broki_roster_import_runs',
    'broki_planner_import_runs'
  ]
  loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists %I on public.%I', 'Authenticated users can read', t);
      execute format('drop policy if exists %I on public.%I', 'broki_dashboard_select', t);
      execute format(
        'create policy %I on public.%I for select to authenticated using (public.broki_has_dashboard_access())',
        'broki_dashboard_select',
        t
      );
    end if;
  end loop;
end;
$$;

-- personnel: hide pending registrations from non-admin viewers? 
-- ponytail: operators need autocomplete — keep SELECT for all dashboard roles.
-- Pending public registrations are still visible to operators (ops review). Admin-only
-- tightening can be a follow-up policy.

-- Privileges: service_role (Edge Functions user-auth lookup) needs full access;
-- authenticated may only read its own row (RLS above); anon nothing.
revoke all on table public.broki_user_access from anon;
revoke all on table public.broki_user_access from authenticated;
grant select on table public.broki_user_access to authenticated;
grant select, insert, update, delete on table public.broki_user_access to service_role;
