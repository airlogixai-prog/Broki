-- PostgREST resolves RPC by parameter NAMES present in the JSON body.
-- n8n sometimes sent only { p_manifest } (migration_id undefined → omitted by JSON.stringify),
-- which looked for broki_audit_source_manifest(p_manifest) — dropped in V3.
-- Restore a single overload that accepts both named args; require migration_id at runtime.

drop function if exists public.broki_audit_source_manifest(text, jsonb);
drop function if exists public.broki_audit_source_manifest(jsonb);

create or replace function public.broki_audit_source_manifest(
  p_manifest jsonb,
  p_migration_id text default null
)
returns table(
  source_system text,
  source_schema text,
  source_table text,
  expected_rows bigint,
  raw_rows bigint,
  delta bigint,
  status text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_migration_id is null or length(trim(p_migration_id)) = 0 then
    raise exception 'p_migration_id_required'
      using hint = 'Pass both p_migration_id and p_manifest. Update n8n node Audit source manifest body.';
  end if;

  return query
  with manifest as (
    select
      m.source_system,
      m.source_schema,
      m.source_table,
      m.expected_rows
    from jsonb_to_recordset(coalesce(p_manifest, '[]'::jsonb)) as m(
      source_system text,
      source_schema text,
      source_table text,
      expected_rows bigint
    )
  ), raw_counts as (
    select
      r.source_system,
      r.source_schema,
      r.source_table,
      count(*)::bigint as raw_rows
    from public.broki_legacy_rows r
    where r.last_migration_id = trim(p_migration_id)
    group by r.source_system, r.source_schema, r.source_table
  )
  select
    m.source_system,
    m.source_schema,
    m.source_table,
    m.expected_rows,
    coalesce(r.raw_rows, 0)::bigint as raw_rows,
    (m.expected_rows - coalesce(r.raw_rows, 0))::bigint as delta,
    case
      when m.expected_rows = coalesce(r.raw_rows, 0) then 'OK'
      else 'MISMATCH'
    end as status
  from manifest m
  left join raw_counts r
    on r.source_system = m.source_system
   and r.source_table = m.source_table
   and r.source_schema is not distinct from m.source_schema
  order by m.source_system, m.source_schema, m.source_table;
end;
$$;

grant execute on function public.broki_audit_source_manifest(jsonb, text) to service_role;

-- Force PostgREST to pick up the new signature immediately.
notify pgrst, 'reload schema';
