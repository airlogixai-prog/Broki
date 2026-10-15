-- Fase 10 verification queries (read-only). Replace :mid.

-- select * from broki_verify_alias_backfill('fc7cbf8b-7c2c-489f-bd85-72fbd38eca4c');
-- select public.broki_backfill_canonical_from_legacy('fc7cbf8b-7c2c-489f-bd85-72fbd38eca4c', true);
-- select public.broki_backfill_canonical_from_legacy('fc7cbf8b-7c2c-489f-bd85-72fbd38eca4c', false);

-- Before/after spot checks:
-- select count(*) filter (where current_worker_text is not null) from broki_assets where source_table = 'pro.furgonetas';
-- select count(*) filter (where aerolinea is not null) from broki_aircraft;
-- select count(*) filter (where tipo is not null) from broki_tooling_catalog;
