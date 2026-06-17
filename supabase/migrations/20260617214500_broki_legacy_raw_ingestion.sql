-- BROKI legacy raw ingestion layer
-- Purpose: preserve every legacy row before normalization into broki_* tables.

create table if not exists public.broki_legacy_rows (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  source_schema text,
  source_table text not null,
  external_id text not null,
  row_hash text,
  row_data jsonb not null,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broki_legacy_rows_source_external_unique
    unique (source_system, source_table, external_id)
);

create index if not exists broki_legacy_rows_source_table_idx
  on public.broki_legacy_rows (source_system, source_table);

create index if not exists broki_legacy_rows_row_data_gin
  on public.broki_legacy_rows using gin (row_data);

drop trigger if exists broki_legacy_rows_set_updated_at on public.broki_legacy_rows;
create trigger broki_legacy_rows_set_updated_at
  before update on public.broki_legacy_rows
  for each row execute function public.set_updated_at();

create table if not exists public.broki_legacy_table_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  source_schema text,
  source_table text not null,
  total_rows integer,
  imported_rows integer not null default 0,
  failed_rows integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'success', 'partial', 'failed')),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists broki_legacy_table_snapshots_lookup_idx
  on public.broki_legacy_table_snapshots (source_system, source_table, status);

create table if not exists public.broki_legacy_import_errors (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid references public.broki_legacy_table_snapshots(id) on delete cascade,
  source_system text not null,
  source_table text not null,
  external_id text,
  error_message text not null,
  row_data jsonb,
  created_at timestamptz not null default now()
);

do $$
declare
  t text;
begin
  foreach t in array array[
    'broki_legacy_rows',
    'broki_legacy_table_snapshots',
    'broki_legacy_import_errors'
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

grant all on table public.broki_legacy_rows to service_role;
grant all on table public.broki_legacy_table_snapshots to service_role;
grant all on table public.broki_legacy_import_errors to service_role;
