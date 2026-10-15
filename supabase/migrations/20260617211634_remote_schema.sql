drop extension if exists "pg_net";

-- ponytail: this migration used to GRANT select/insert/update/delete on every
-- public.broki_* table to anon/authenticated/service_role. Those statements ran
-- BEFORE 20260617213000_broki_core_schema.sql created the tables, so
-- `supabase db reset` failed from an empty database.
--
-- Grants are now owned by 20260620000100_broki_grants_realtime.sql, which runs
-- after every table exists and additionally revokes the anon write privileges
-- this file used to hand out. Projects that already applied this version keep
-- their migration history intact; the later migration converges their grants to
-- the canonical state.
