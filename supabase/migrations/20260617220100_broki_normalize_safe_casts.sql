-- Safe json casts for dirty legacy values (e.g. "¬" in numeric columns)

create or replace function public.broki_jnumeric(j jsonb, keys text[])
returns numeric
language plpgsql
immutable
as $$
declare v text;
begin
  v := public.broki_jtxt(j, keys);
  if v is null then return null; end if;
  begin
    return v::numeric;
  exception when others then
    return null;
  end;
end;
$$;

create or replace function public.broki_jbigint(j jsonb, keys text[])
returns bigint
language plpgsql
immutable
as $$
declare v text;
begin
  v := public.broki_jtxt(j, keys);
  if v is null then return null; end if;
  begin
    return v::bigint;
  exception when others then
    return null;
  end;
end;
$$;

create or replace function public.broki_jint(j jsonb, keys text[])
returns integer
language plpgsql
immutable
as $$
declare v text;
begin
  v := public.broki_jtxt(j, keys);
  if v is null then return null; end if;
  begin
    return v::integer;
  exception when others then
    return null;
  end;
end;
$$;

create or replace function public.broki_jtimestamptz(j jsonb, keys text[])
returns timestamptz
language plpgsql
immutable
as $$
declare v text;
begin
  v := public.broki_jtxt(j, keys);
  if v is null then return null; end if;
  begin
    return v::timestamptz;
  exception when others then
    return null;
  end;
end;
$$;

create or replace function public.broki_jdate(j jsonb, keys text[])
returns date
language plpgsql
immutable
as $$
declare v text;
begin
  v := public.broki_jtxt(j, keys);
  if v is null then return null; end if;
  begin
    return v::date;
  exception when others then
    return null;
  end;
end;
$$;
