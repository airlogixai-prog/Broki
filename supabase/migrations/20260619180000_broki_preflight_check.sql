-- BROKI pre-flight: ensure canonical tables are populated before migrating Edge Functions.
-- Run in Supabase Studio SQL editor (or supabase db push) to verify state.
-- Safe to run repeatedly: read-only validation + conditional normalize.

do $$
declare
  asset_count  bigint;
  raw_count    bigint;
begin
  select count(*) into asset_count from public.broki_assets;
  select count(*) into raw_count   from public.broki_legacy_rows
    where source_table in ('inventario', 'furgonetas', 'gse');

  if asset_count = 0 and raw_count > 0 then
    raise notice 'broki_assets is empty but % raw rows exist. Running normalize_all().', raw_count;
    perform public.broki_normalize_all();
    select count(*) into asset_count from public.broki_assets;
    raise notice 'normalize_all() complete. broki_assets now has % rows.', asset_count;
  elsif asset_count = 0 and raw_count = 0 then
    raise warning 'Both broki_assets and broki_legacy_rows are empty. '
      'Run broki-import-batch first to ingest data from n8n before deploying Edge Functions.';
  else
    raise notice 'Pre-flight OK. broki_assets has % rows.', asset_count;
  end if;
end;
$$;

-- Validation summary — review counts before deploying PR1
select entity, raw_count, canonical_count,
  case when canonical_count = 0 then 'EMPTY - run normalize' else 'OK' end as status
from public.broki_normalize_legacy_validate();
