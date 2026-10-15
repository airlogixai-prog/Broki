-- Fase 12: domain relations text → UUID (exact unique only; no fuzzy).
-- Snapshots for historical text. Classify leftovers. FKs nullable; no NOT NULL.

create extension if not exists unaccent with schema extensions;

-- Prefer extensions.unaccent; fallback if search_path differs.
create or replace function public.broki_norm_text(p text)
returns text
language sql
immutable
parallel safe
as $$
  select nullif(
    lower(trim(extensions.unaccent(coalesce(p, '')))),
    ''
  );
$$;

create or replace function public.broki_norm_code(p text)
returns text
language sql
immutable
parallel safe
as $$
  select nullif(upper(trim(coalesce(p, ''))), '');
$$;

-- Personnel ↔ auth.users (verifiable identity only)
alter table public.broki_personnel
  add column if not exists auth_user_id uuid;

-- Snapshots (preserve free text after UUID link)
alter table public.broki_assets
  add column if not exists worker_name_snapshot text,
  add column if not exists aircraft_registration_snapshot text;

alter table public.broki_incidents
  add column if not exists aircraft_id uuid,
  add column if not exists planner_task_id uuid;

create table if not exists public.broki_relation_resolutions (
  id bigserial primary key,
  run_id uuid not null,
  dry_run boolean not null,
  entity_type text not null,
  entity_id uuid not null,
  relation text not null,
  text_value text,
  resolved_id uuid,
  classification text not null
    check (classification in (
      'LINKED',
      'MANUAL_REVIEW',
      'HISTORICAL_UNRESOLVABLE',
      'EMPTY',
      'ALREADY_LINKED'
    )),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists broki_relation_resolutions_run_idx
  on public.broki_relation_resolutions (run_id);
create index if not exists broki_relation_resolutions_class_idx
  on public.broki_relation_resolutions (classification);

-- Unique lookup helpers: only keys with exactly one candidate.
create or replace function public.broki_unique_personnel_by_norm()
returns table(norm_name text, person_id uuid)
language sql
stable
as $$
  select public.broki_norm_text(p.nombre) as norm_name, (array_agg(p.id))[1] as person_id
  from public.broki_personnel p
  where public.broki_norm_text(p.nombre) is not null
  group by 1
  having count(distinct p.id) = 1;
$$;

create or replace function public.broki_ambiguous_personnel_norms()
returns table(norm_name text)
language sql
stable
as $$
  select public.broki_norm_text(p.nombre)
  from public.broki_personnel p
  where public.broki_norm_text(p.nombre) is not null
  group by 1
  having count(distinct p.id) > 1;
$$;

create or replace function public.broki_unique_aircraft_by_norm()
returns table(norm_mat text, aircraft_id uuid)
language sql
stable
as $$
  select public.broki_norm_code(a.matricula), (array_agg(a.id))[1]
  from public.broki_aircraft a
  where public.broki_norm_code(a.matricula) is not null
  group by 1
  having count(distinct a.id) = 1;
$$;

create or replace function public.broki_unique_asset_by_ident()
returns table(norm_ident text, asset_id uuid)
language sql
stable
as $$
  select public.broki_norm_code(a.identifier), (array_agg(a.id))[1]
  from public.broki_assets a
  where public.broki_norm_code(a.identifier) is not null
  group by 1
  having count(distinct a.id) = 1;
$$;

create or replace function public.broki_resolve_domain_relations(
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_run uuid := gen_random_uuid();
  v_linked int := 0;
  v_manual int := 0;
  v_hist int := 0;
  v_n int;
  r record;
  v_id uuid;
  v_class text;
  v_reason text;
begin
  -- Seed snapshots from current free text (idempotent)
  if not p_dry_run then
    update public.broki_assets
    set
      worker_name_snapshot = coalesce(worker_name_snapshot, current_worker_text),
      aircraft_registration_snapshot = coalesce(aircraft_registration_snapshot, avion_text)
    where (current_worker_text is not null and worker_name_snapshot is null)
       or (avion_text is not null and aircraft_registration_snapshot is null);
  end if;

  ------------------------------------------------------------------
  -- PERSONNEL ↔ auth.users (email then phone; unique only)
  ------------------------------------------------------------------
  for r in
    select p.id as person_id, p.correo, p.telefono, p.auth_user_id
    from public.broki_personnel p
  loop
    if r.auth_user_id is not null then
      insert into public.broki_relation_resolutions (
        run_id, dry_run, entity_type, entity_id, relation, text_value, resolved_id, classification, reason
      ) values (
        v_run, p_dry_run, 'personnel', r.person_id, 'auth_user_id', r.correo, r.auth_user_id, 'ALREADY_LINKED', null
      );
      continue;
    end if;

    v_id := null;
    v_class := null;
    v_reason := null;

    if r.correo is not null and length(trim(r.correo)) > 0 then
      select u.id into v_id
      from auth.users u
      where lower(trim(u.email)) = lower(trim(r.correo))
      limit 2;
      -- recount
      select case when count(*) = 1 then (array_agg(u.id))[1] else null end into v_id
      from auth.users u
      where lower(trim(u.email)) = lower(trim(r.correo));

      if v_id is not null then
        v_class := 'LINKED';
        v_reason := 'email_exact';
      elsif exists (
        select 1 from auth.users u where lower(trim(u.email)) = lower(trim(r.correo))
      ) then
        v_class := 'MANUAL_REVIEW';
        v_reason := 'email_ambiguous';
      end if;
    end if;

    if v_class is null and r.telefono is not null then
      select case when count(*) = 1 then (array_agg(u.id))[1] else null end into v_id
      from auth.users u
      where regexp_replace(coalesce(u.phone, ''), '\D', '', 'g')
          = regexp_replace(r.telefono, '\D', '', 'g')
        and length(regexp_replace(r.telefono, '\D', '', 'g')) >= 9;

      if v_id is not null then
        v_class := 'LINKED';
        v_reason := 'phone_exact';
      elsif exists (
        select 1 from auth.users u
        where regexp_replace(coalesce(u.phone, ''), '\D', '', 'g')
            = regexp_replace(r.telefono, '\D', '', 'g')
          and length(regexp_replace(r.telefono, '\D', '', 'g')) >= 9
      ) then
        v_class := 'MANUAL_REVIEW';
        v_reason := 'phone_ambiguous';
      end if;
    end if;

    if v_class is null then
      if (r.correo is null or length(trim(r.correo)) = 0)
         and (r.telefono is null or length(regexp_replace(r.telefono, '\D', '', 'g')) < 9) then
        v_class := 'EMPTY';
        v_reason := 'no_verifiable_identity';
      else
        v_class := 'HISTORICAL_UNRESOLVABLE';
        v_reason := 'no_auth_user_exact';
      end if;
      v_id := null;
    end if;

    insert into public.broki_relation_resolutions (
      run_id, dry_run, entity_type, entity_id, relation, text_value, resolved_id, classification, reason
    ) values (
      v_run, p_dry_run, 'personnel', r.person_id, 'auth_user_id',
      coalesce(r.correo, r.telefono), v_id, v_class, v_reason
    );

    if v_class = 'LINKED' and not p_dry_run then
      update public.broki_personnel set auth_user_id = v_id, updated_at = now()
      where id = r.person_id and auth_user_id is null;
      v_linked := v_linked + 1;
    elsif v_class = 'MANUAL_REVIEW' then
      v_manual := v_manual + 1;
    elsif v_class = 'HISTORICAL_UNRESOLVABLE' then
      v_hist := v_hist + 1;
    end if;
  end loop;

  ------------------------------------------------------------------
  -- ASSETS: current_worker_id / aircraft_id
  ------------------------------------------------------------------
  for r in
    select a.id, a.current_worker_text, a.current_worker_id, a.avion_text, a.aircraft_id
    from public.broki_assets a
  loop
    -- worker
    if r.current_worker_id is not null then
      insert into public.broki_relation_resolutions (
        run_id, dry_run, entity_type, entity_id, relation, text_value, resolved_id, classification, reason
      ) values (
        v_run, p_dry_run, 'asset', r.id, 'current_worker_id', r.current_worker_text,
        r.current_worker_id, 'ALREADY_LINKED', null
      );
    else
      v_id := null;
      select up.person_id into v_id
      from public.broki_unique_personnel_by_norm() up
      where up.norm_name = public.broki_norm_text(r.current_worker_text);

      if r.current_worker_text is null or public.broki_norm_text(r.current_worker_text) is null then
        v_class := 'EMPTY'; v_reason := 'no_worker_text'; v_id := null;
      elsif v_id is not null then
        v_class := 'LINKED'; v_reason := 'nombre_exact_unique';
      elsif exists (
        select 1 from public.broki_ambiguous_personnel_norms() ap
        where ap.norm_name = public.broki_norm_text(r.current_worker_text)
      ) then
        v_class := 'MANUAL_REVIEW'; v_reason := 'nombre_ambiguous'; v_id := null;
      else
        v_class := 'HISTORICAL_UNRESOLVABLE'; v_reason := 'nombre_no_match'; v_id := null;
      end if;

      insert into public.broki_relation_resolutions (
        run_id, dry_run, entity_type, entity_id, relation, text_value, resolved_id, classification, reason
      ) values (
        v_run, p_dry_run, 'asset', r.id, 'current_worker_id', r.current_worker_text, v_id, v_class, v_reason
      );

      if v_class = 'LINKED' then
        if not p_dry_run then
          update public.broki_assets
          set current_worker_id = v_id,
              worker_name_snapshot = coalesce(worker_name_snapshot, current_worker_text),
              updated_at = now()
          where id = r.id;
        end if;
        v_linked := v_linked + 1;
      elsif v_class = 'MANUAL_REVIEW' then v_manual := v_manual + 1;
      elsif v_class = 'HISTORICAL_UNRESOLVABLE' then v_hist := v_hist + 1;
      end if;
    end if;

    -- aircraft
    if r.aircraft_id is not null then
      insert into public.broki_relation_resolutions (
        run_id, dry_run, entity_type, entity_id, relation, text_value, resolved_id, classification, reason
      ) values (
        v_run, p_dry_run, 'asset', r.id, 'aircraft_id', r.avion_text, r.aircraft_id, 'ALREADY_LINKED', null
      );
    else
      select ua.aircraft_id into v_id
      from public.broki_unique_aircraft_by_norm() ua
      where ua.norm_mat = public.broki_norm_code(r.avion_text);

      if r.avion_text is null or public.broki_norm_code(r.avion_text) is null then
        v_class := 'EMPTY'; v_reason := 'no_avion_text'; v_id := null;
      elsif v_id is not null then
        v_class := 'LINKED'; v_reason := 'matricula_exact_unique';
      else
        v_class := 'HISTORICAL_UNRESOLVABLE'; v_reason := 'matricula_no_exact_match'; v_id := null;
      end if;

      insert into public.broki_relation_resolutions (
        run_id, dry_run, entity_type, entity_id, relation, text_value, resolved_id, classification, reason
      ) values (
        v_run, p_dry_run, 'asset', r.id, 'aircraft_id', r.avion_text, v_id, v_class, v_reason
      );

      if v_class = 'LINKED' then
        if not p_dry_run then
          update public.broki_assets
          set aircraft_id = v_id,
              aircraft_registration_snapshot = coalesce(aircraft_registration_snapshot, avion_text),
              updated_at = now()
          where id = r.id;
        end if;
        v_linked := v_linked + 1;
      elsif v_class = 'HISTORICAL_UNRESOLVABLE' then v_hist := v_hist + 1;
      end if;
    end if;
  end loop;

  ------------------------------------------------------------------
  -- INCIDENTS: asset (already), worker, aircraft via asset, task (no key)
  ------------------------------------------------------------------
  for r in
    select i.id, i.id_objeto, i.asset_id, i.trabajador_text, i.worker_id, i.aircraft_id, i.planner_task_id
    from public.broki_incidents i
  loop
    -- worker
    if r.worker_id is not null then
      insert into public.broki_relation_resolutions (
        run_id, dry_run, entity_type, entity_id, relation, text_value, resolved_id, classification, reason
      ) values (
        v_run, p_dry_run, 'incident', r.id, 'worker_id', r.trabajador_text, r.worker_id, 'ALREADY_LINKED', null
      );
    else
      select up.person_id into v_id
      from public.broki_unique_personnel_by_norm() up
      where up.norm_name = public.broki_norm_text(r.trabajador_text);

      if r.trabajador_text is null or public.broki_norm_text(r.trabajador_text) is null then
        v_class := 'EMPTY'; v_reason := 'no_trabajador_text'; v_id := null;
      elsif v_id is not null then
        v_class := 'LINKED'; v_reason := 'nombre_exact_unique';
      elsif exists (
        select 1 from public.broki_ambiguous_personnel_norms() ap
        where ap.norm_name = public.broki_norm_text(r.trabajador_text)
      ) then
        v_class := 'MANUAL_REVIEW'; v_reason := 'nombre_ambiguous'; v_id := null;
      else
        v_class := 'HISTORICAL_UNRESOLVABLE'; v_reason := 'nombre_no_match'; v_id := null;
      end if;

      insert into public.broki_relation_resolutions (
        run_id, dry_run, entity_type, entity_id, relation, text_value, resolved_id, classification, reason
      ) values (
        v_run, p_dry_run, 'incident', r.id, 'worker_id', r.trabajador_text, v_id, v_class, v_reason
      );

      if v_class = 'LINKED' then
        if not p_dry_run then
          update public.broki_incidents set worker_id = v_id, updated_at = now() where id = r.id;
        end if;
        v_linked := v_linked + 1;
      elsif v_class = 'MANUAL_REVIEW' then v_manual := v_manual + 1;
      elsif v_class = 'HISTORICAL_UNRESOLVABLE' then v_hist := v_hist + 1;
      end if;
    end if;

    -- aircraft via asset UUID (not free text invent)
    if r.aircraft_id is not null then
      insert into public.broki_relation_resolutions (
        run_id, dry_run, entity_type, entity_id, relation, resolved_id, classification, reason
      ) values (
        v_run, p_dry_run, 'incident', r.id, 'aircraft_id', r.aircraft_id, 'ALREADY_LINKED', null
      );
    else
      select a.aircraft_id into v_id
      from public.broki_assets a
      where a.id = r.asset_id;

      if r.asset_id is null then
        v_class := 'EMPTY'; v_reason := 'no_asset'; v_id := null;
      elsif v_id is not null then
        v_class := 'LINKED'; v_reason := 'via_asset_aircraft_id';
      else
        v_class := 'HISTORICAL_UNRESOLVABLE'; v_reason := 'asset_has_no_aircraft'; v_id := null;
      end if;

      insert into public.broki_relation_resolutions (
        run_id, dry_run, entity_type, entity_id, relation, text_value, resolved_id, classification, reason
      ) values (
        v_run, p_dry_run, 'incident', r.id, 'aircraft_id', r.id_objeto, v_id, v_class, v_reason
      );

      if v_class = 'LINKED' then
        if not p_dry_run then
          update public.broki_incidents set aircraft_id = v_id, updated_at = now() where id = r.id;
        end if;
        v_linked := v_linked + 1;
      elsif v_class = 'HISTORICAL_UNRESOLVABLE' then v_hist := v_hist + 1;
      end if;
    end if;

    -- planner_task: no source key in legacy payload → historical
    if r.planner_task_id is not null then
      insert into public.broki_relation_resolutions (
        run_id, dry_run, entity_type, entity_id, relation, resolved_id, classification, reason
      ) values (
        v_run, p_dry_run, 'incident', r.id, 'planner_task_id', r.planner_task_id, 'ALREADY_LINKED', null
      );
    else
      insert into public.broki_relation_resolutions (
        run_id, dry_run, entity_type, entity_id, relation, classification, reason
      ) values (
        v_run, p_dry_run, 'incident', r.id, 'planner_task_id',
        'HISTORICAL_UNRESOLVABLE', 'no_source_task_key_in_legacy'
      );
      v_hist := v_hist + 1;
    end if;
  end loop;

  ------------------------------------------------------------------
  -- PLANNER groups / members / tasks
  ------------------------------------------------------------------
  for r in
    select g.id, g.id_avion, g.aircraft_id, g.vehiculo, g.vehicle_asset_id,
           g.responsable, g.responsible_person_id
    from public.broki_planner_groups g
  loop
    -- aircraft
    if r.aircraft_id is null then
      select ua.aircraft_id into v_id from public.broki_unique_aircraft_by_norm() ua
      where ua.norm_mat = public.broki_norm_code(r.id_avion);
      if r.id_avion is null or public.broki_norm_code(r.id_avion) is null then
        v_class := 'EMPTY'; v_id := null; v_reason := 'no_id_avion';
      elsif v_id is not null then
        v_class := 'LINKED'; v_reason := 'matricula_exact_unique';
      else
        v_class := 'HISTORICAL_UNRESOLVABLE'; v_id := null; v_reason := 'matricula_no_exact_match';
      end if;
      insert into public.broki_relation_resolutions (
        run_id, dry_run, entity_type, entity_id, relation, text_value, resolved_id, classification, reason
      ) values (v_run, p_dry_run, 'planner_group', r.id, 'aircraft_id', r.id_avion, v_id, v_class, v_reason);
      if v_class = 'LINKED' then
        if not p_dry_run then
          update public.broki_planner_groups set aircraft_id = v_id, updated_at = now() where id = r.id;
        end if;
        v_linked := v_linked + 1;
      elsif v_class = 'HISTORICAL_UNRESOLVABLE' then v_hist := v_hist + 1;
      end if;
    end if;

    -- vehicle asset
    if r.vehicle_asset_id is null then
      select ua.asset_id into v_id from public.broki_unique_asset_by_ident() ua
      where ua.norm_ident = public.broki_norm_code(r.vehiculo);
      if r.vehiculo is null or public.broki_norm_code(r.vehiculo) is null then
        v_class := 'EMPTY'; v_id := null; v_reason := 'no_vehiculo';
      elsif v_id is not null then
        v_class := 'LINKED'; v_reason := 'identifier_exact_unique';
      else
        v_class := 'HISTORICAL_UNRESOLVABLE'; v_id := null; v_reason := 'identifier_no_match';
      end if;
      insert into public.broki_relation_resolutions (
        run_id, dry_run, entity_type, entity_id, relation, text_value, resolved_id, classification, reason
      ) values (v_run, p_dry_run, 'planner_group', r.id, 'vehicle_asset_id', r.vehiculo, v_id, v_class, v_reason);
      if v_class = 'LINKED' then
        if not p_dry_run then
          update public.broki_planner_groups set vehicle_asset_id = v_id, updated_at = now() where id = r.id;
        end if;
        v_linked := v_linked + 1;
      elsif v_class = 'HISTORICAL_UNRESOLVABLE' then v_hist := v_hist + 1;
      end if;
    end if;

    -- responsible
    if r.responsible_person_id is null then
      select up.person_id into v_id from public.broki_unique_personnel_by_norm() up
      where up.norm_name = public.broki_norm_text(r.responsable);
      if r.responsable is null or public.broki_norm_text(r.responsable) is null then
        v_class := 'EMPTY'; v_id := null; v_reason := 'no_responsable';
      elsif v_id is not null then
        v_class := 'LINKED'; v_reason := 'nombre_exact_unique';
      elsif exists (
        select 1 from public.broki_ambiguous_personnel_norms() ap
        where ap.norm_name = public.broki_norm_text(r.responsable)
      ) then
        v_class := 'MANUAL_REVIEW'; v_id := null; v_reason := 'nombre_ambiguous';
      else
        v_class := 'HISTORICAL_UNRESOLVABLE'; v_id := null; v_reason := 'nombre_no_match';
      end if;
      insert into public.broki_relation_resolutions (
        run_id, dry_run, entity_type, entity_id, relation, text_value, resolved_id, classification, reason
      ) values (v_run, p_dry_run, 'planner_group', r.id, 'responsible_person_id', r.responsable, v_id, v_class, v_reason);
      if v_class = 'LINKED' then
        if not p_dry_run then
          update public.broki_planner_groups set responsible_person_id = v_id, updated_at = now() where id = r.id;
        end if;
        v_linked := v_linked + 1;
      elsif v_class = 'MANUAL_REVIEW' then v_manual := v_manual + 1;
      elsif v_class = 'HISTORICAL_UNRESOLVABLE' then v_hist := v_hist + 1;
      end if;
    end if;
  end loop;

  for r in
    select m.id, m.worker_text, m.person_id from public.broki_planner_group_members m
  loop
    if r.person_id is not null then
      insert into public.broki_relation_resolutions (
        run_id, dry_run, entity_type, entity_id, relation, text_value, resolved_id, classification, reason
      ) values (v_run, p_dry_run, 'planner_member', r.id, 'person_id', r.worker_text, r.person_id, 'ALREADY_LINKED', null);
      continue;
    end if;
    select up.person_id into v_id from public.broki_unique_personnel_by_norm() up
    where up.norm_name = public.broki_norm_text(r.worker_text);
    if r.worker_text is null or public.broki_norm_text(r.worker_text) is null then
      v_class := 'EMPTY'; v_id := null; v_reason := 'no_worker_text';
    elsif v_id is not null then
      v_class := 'LINKED'; v_reason := 'nombre_exact_unique';
    elsif exists (
      select 1 from public.broki_ambiguous_personnel_norms() ap
      where ap.norm_name = public.broki_norm_text(r.worker_text)
    ) then
      v_class := 'MANUAL_REVIEW'; v_id := null; v_reason := 'nombre_ambiguous';
    else
      v_class := 'HISTORICAL_UNRESOLVABLE'; v_id := null; v_reason := 'nombre_no_match';
    end if;
    insert into public.broki_relation_resolutions (
      run_id, dry_run, entity_type, entity_id, relation, text_value, resolved_id, classification, reason
    ) values (v_run, p_dry_run, 'planner_member', r.id, 'person_id', r.worker_text, v_id, v_class, v_reason);
    if v_class = 'LINKED' then
      if not p_dry_run then
        update public.broki_planner_group_members set person_id = v_id, updated_at = now() where id = r.id;
      end if;
      v_linked := v_linked + 1;
    elsif v_class = 'MANUAL_REVIEW' then v_manual := v_manual + 1;
    elsif v_class = 'HISTORICAL_UNRESOLVABLE' then v_hist := v_hist + 1;
    end if;
  end loop;

  -- tasks: group (SOURCE_GROUP_NULL stays empty/historical), aircraft
  for r in
    select t.id, t.group_id, t.grupo_trabajo_external_id, t.matricula_avion, t.aircraft_id,
           t.source_system
    from public.broki_planner_tasks t
  loop
    if r.group_id is null then
      if r.grupo_trabajo_external_id is null
         or public.broki_norm_text(r.grupo_trabajo_external_id) is null then
        v_class := 'HISTORICAL_UNRESOLVABLE'; v_id := null; v_reason := 'source_group_null';
      else
        select g.id into v_id
        from public.broki_planner_groups g
        where g.source_system = r.source_system
          and g.external_id = r.grupo_trabajo_external_id;
        if v_id is not null then
          v_class := 'LINKED'; v_reason := 'grupo_external_id_exact';
        else
          v_class := 'HISTORICAL_UNRESOLVABLE'; v_reason := 'group_external_id_missing';
        end if;
      end if;
      insert into public.broki_relation_resolutions (
        run_id, dry_run, entity_type, entity_id, relation, text_value, resolved_id, classification, reason
      ) values (
        v_run, p_dry_run, 'planner_task', r.id, 'group_id', r.grupo_trabajo_external_id, v_id, v_class, v_reason
      );
      if v_class = 'LINKED' then
        if not p_dry_run then
          update public.broki_planner_tasks set group_id = v_id, updated_at = now() where id = r.id;
        end if;
        v_linked := v_linked + 1;
      elsif v_class = 'HISTORICAL_UNRESOLVABLE' then v_hist := v_hist + 1;
      end if;
    end if;

    if r.aircraft_id is null then
      select ua.aircraft_id into v_id from public.broki_unique_aircraft_by_norm() ua
      where ua.norm_mat = public.broki_norm_code(r.matricula_avion);
      if r.matricula_avion is null or public.broki_norm_code(r.matricula_avion) is null then
        v_class := 'EMPTY'; v_id := null; v_reason := 'no_matricula';
      elsif v_id is not null then
        v_class := 'LINKED'; v_reason := 'matricula_exact_unique';
      else
        v_class := 'HISTORICAL_UNRESOLVABLE'; v_id := null; v_reason := 'matricula_no_exact_match';
      end if;
      insert into public.broki_relation_resolutions (
        run_id, dry_run, entity_type, entity_id, relation, text_value, resolved_id, classification, reason
      ) values (v_run, p_dry_run, 'planner_task', r.id, 'aircraft_id', r.matricula_avion, v_id, v_class, v_reason);
      if v_class = 'LINKED' then
        if not p_dry_run then
          update public.broki_planner_tasks set aircraft_id = v_id, updated_at = now() where id = r.id;
        end if;
        v_linked := v_linked + 1;
      elsif v_class = 'HISTORICAL_UNRESOLVABLE' then v_hist := v_hist + 1;
      end if;
    end if;
  end loop;

  ------------------------------------------------------------------
  -- TOOLING movements: tool, personnel out/in, aircraft
  ------------------------------------------------------------------
  for r in
    select tm.id, tm.bac_bact, tm.tool_id, tm.tma_out, tm.tma_out_person_id,
           tm.tma_in, tm.tma_in_person_id, tm.avion, tm.aircraft_id
    from public.broki_tooling_movements tm
  loop
    if r.tool_id is null then
      select tc.id into v_id
      from public.broki_tooling_catalog tc
      where public.broki_norm_code(tc.bac_bact) = public.broki_norm_code(r.bac_bact);
      -- ensure unique
      if (
        select count(*) from public.broki_tooling_catalog tc
        where public.broki_norm_code(tc.bac_bact) = public.broki_norm_code(r.bac_bact)
      ) = 1 and v_id is not null then
        v_class := 'LINKED'; v_reason := 'bac_exact_unique';
      elsif r.bac_bact is null then
        v_class := 'EMPTY'; v_id := null; v_reason := 'no_bac';
      elsif (
        select count(*) from public.broki_tooling_catalog tc
        where public.broki_norm_code(tc.bac_bact) = public.broki_norm_code(r.bac_bact)
      ) > 1 then
        v_class := 'MANUAL_REVIEW'; v_id := null; v_reason := 'bac_ambiguous';
      else
        v_class := 'HISTORICAL_UNRESOLVABLE'; v_id := null; v_reason := 'bac_no_match';
      end if;
      insert into public.broki_relation_resolutions (
        run_id, dry_run, entity_type, entity_id, relation, text_value, resolved_id, classification, reason
      ) values (v_run, p_dry_run, 'tooling_movement', r.id, 'tool_id', r.bac_bact, v_id, v_class, v_reason);
      if v_class = 'LINKED' then
        if not p_dry_run then
          update public.broki_tooling_movements set tool_id = v_id, updated_at = now() where id = r.id;
        end if;
        v_linked := v_linked + 1;
      elsif v_class = 'MANUAL_REVIEW' then v_manual := v_manual + 1;
      elsif v_class = 'HISTORICAL_UNRESOLVABLE' then v_hist := v_hist + 1;
      end if;
    end if;

    -- tma_out
    if r.tma_out_person_id is null then
      select up.person_id into v_id from public.broki_unique_personnel_by_norm() up
      where up.norm_name = public.broki_norm_text(r.tma_out);
      if r.tma_out is null or public.broki_norm_text(r.tma_out) is null then
        v_class := 'EMPTY'; v_id := null; v_reason := 'no_tma_out';
      elsif v_id is not null then
        v_class := 'LINKED'; v_reason := 'nombre_exact_unique';
      elsif exists (
        select 1 from public.broki_ambiguous_personnel_norms() ap
        where ap.norm_name = public.broki_norm_text(r.tma_out)
      ) then
        v_class := 'MANUAL_REVIEW'; v_id := null; v_reason := 'nombre_ambiguous';
      else
        v_class := 'HISTORICAL_UNRESOLVABLE'; v_id := null; v_reason := 'nombre_no_match';
      end if;
      insert into public.broki_relation_resolutions (
        run_id, dry_run, entity_type, entity_id, relation, text_value, resolved_id, classification, reason
      ) values (v_run, p_dry_run, 'tooling_movement', r.id, 'tma_out_person_id', r.tma_out, v_id, v_class, v_reason);
      if v_class = 'LINKED' then
        if not p_dry_run then
          update public.broki_tooling_movements set tma_out_person_id = v_id, updated_at = now() where id = r.id;
        end if;
        v_linked := v_linked + 1;
      elsif v_class = 'MANUAL_REVIEW' then v_manual := v_manual + 1;
      elsif v_class = 'HISTORICAL_UNRESOLVABLE' then v_hist := v_hist + 1;
      end if;
    end if;

    if r.tma_in_person_id is null then
      select up.person_id into v_id from public.broki_unique_personnel_by_norm() up
      where up.norm_name = public.broki_norm_text(r.tma_in);
      if r.tma_in is null or public.broki_norm_text(r.tma_in) is null then
        v_class := 'EMPTY'; v_id := null; v_reason := 'no_tma_in';
      elsif v_id is not null then
        v_class := 'LINKED'; v_reason := 'nombre_exact_unique';
      elsif exists (
        select 1 from public.broki_ambiguous_personnel_norms() ap
        where ap.norm_name = public.broki_norm_text(r.tma_in)
      ) then
        v_class := 'MANUAL_REVIEW'; v_id := null; v_reason := 'nombre_ambiguous';
      else
        v_class := 'HISTORICAL_UNRESOLVABLE'; v_id := null; v_reason := 'nombre_no_match';
      end if;
      insert into public.broki_relation_resolutions (
        run_id, dry_run, entity_type, entity_id, relation, text_value, resolved_id, classification, reason
      ) values (v_run, p_dry_run, 'tooling_movement', r.id, 'tma_in_person_id', r.tma_in, v_id, v_class, v_reason);
      if v_class = 'LINKED' then
        if not p_dry_run then
          update public.broki_tooling_movements set tma_in_person_id = v_id, updated_at = now() where id = r.id;
        end if;
        v_linked := v_linked + 1;
      elsif v_class = 'MANUAL_REVIEW' then v_manual := v_manual + 1;
      elsif v_class = 'HISTORICAL_UNRESOLVABLE' then v_hist := v_hist + 1;
      end if;
    end if;

    if r.aircraft_id is null then
      select ua.aircraft_id into v_id from public.broki_unique_aircraft_by_norm() ua
      where ua.norm_mat = public.broki_norm_code(r.avion);
      if r.avion is null or public.broki_norm_code(r.avion) is null then
        v_class := 'EMPTY'; v_id := null; v_reason := 'no_avion';
      elsif v_id is not null then
        v_class := 'LINKED'; v_reason := 'matricula_exact_unique';
      else
        v_class := 'HISTORICAL_UNRESOLVABLE'; v_id := null; v_reason := 'matricula_no_exact_match';
      end if;
      insert into public.broki_relation_resolutions (
        run_id, dry_run, entity_type, entity_id, relation, text_value, resolved_id, classification, reason
      ) values (v_run, p_dry_run, 'tooling_movement', r.id, 'aircraft_id', r.avion, v_id, v_class, v_reason);
      if v_class = 'LINKED' then
        if not p_dry_run then
          update public.broki_tooling_movements set aircraft_id = v_id, updated_at = now() where id = r.id;
        end if;
        v_linked := v_linked + 1;
      elsif v_class = 'HISTORICAL_UNRESOLVABLE' then v_hist := v_hist + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'run_id', v_run,
    'dry_run', p_dry_run,
    'linked', v_linked,
    'manual_review', v_manual,
    'historical_unresolvable', v_hist,
    'applied', not p_dry_run
  );
end;
$$;

revoke all on function public.broki_resolve_domain_relations(boolean) from public;
grant execute on function public.broki_resolve_domain_relations(boolean) to service_role;

-- Recoverable orphan = text present + UUID null + exact unique candidate exists.
create or replace function public.broki_verify_relation_integrity()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_recoverable int := 0;
  v_n int;
begin
  -- assets worker
  select count(*)::int into v_n
  from public.broki_assets a
  join public.broki_unique_personnel_by_norm() up
    on up.norm_name = public.broki_norm_text(a.current_worker_text)
  where a.current_worker_id is null
    and public.broki_norm_text(a.current_worker_text) is not null;
  v_recoverable := v_recoverable + v_n;

  select count(*)::int into v_n
  from public.broki_assets a
  join public.broki_unique_aircraft_by_norm() ua
    on ua.norm_mat = public.broki_norm_code(a.avion_text)
  where a.aircraft_id is null
    and public.broki_norm_code(a.avion_text) is not null;
  v_recoverable := v_recoverable + v_n;

  select count(*)::int into v_n
  from public.broki_incidents i
  join public.broki_unique_personnel_by_norm() up
    on up.norm_name = public.broki_norm_text(i.trabajador_text)
  where i.worker_id is null
    and public.broki_norm_text(i.trabajador_text) is not null;
  v_recoverable := v_recoverable + v_n;

  select count(*)::int into v_n
  from public.broki_incidents i
  join public.broki_assets a on a.id = i.asset_id
  where i.aircraft_id is null and a.aircraft_id is not null;
  v_recoverable := v_recoverable + v_n;

  select count(*)::int into v_n
  from public.broki_planner_groups g
  join public.broki_unique_aircraft_by_norm() ua
    on ua.norm_mat = public.broki_norm_code(g.id_avion)
  where g.aircraft_id is null and public.broki_norm_code(g.id_avion) is not null;
  v_recoverable := v_recoverable + v_n;

  select count(*)::int into v_n
  from public.broki_planner_groups g
  join public.broki_unique_asset_by_ident() ua
    on ua.norm_ident = public.broki_norm_code(g.vehiculo)
  where g.vehicle_asset_id is null and public.broki_norm_code(g.vehiculo) is not null;
  v_recoverable := v_recoverable + v_n;

  select count(*)::int into v_n
  from public.broki_planner_groups g
  join public.broki_unique_personnel_by_norm() up
    on up.norm_name = public.broki_norm_text(g.responsable)
  where g.responsible_person_id is null and public.broki_norm_text(g.responsable) is not null;
  v_recoverable := v_recoverable + v_n;

  select count(*)::int into v_n
  from public.broki_planner_group_members m
  join public.broki_unique_personnel_by_norm() up
    on up.norm_name = public.broki_norm_text(m.worker_text)
  where m.person_id is null and public.broki_norm_text(m.worker_text) is not null;
  v_recoverable := v_recoverable + v_n;

  select count(*)::int into v_n
  from public.broki_planner_tasks t
  join public.broki_unique_aircraft_by_norm() ua
    on ua.norm_mat = public.broki_norm_code(t.matricula_avion)
  where t.aircraft_id is null and public.broki_norm_code(t.matricula_avion) is not null;
  v_recoverable := v_recoverable + v_n;

  select count(*)::int into v_n
  from public.broki_tooling_movements tm
  join public.broki_unique_personnel_by_norm() up
    on up.norm_name = public.broki_norm_text(tm.tma_out)
  where tm.tma_out_person_id is null and public.broki_norm_text(tm.tma_out) is not null;
  v_recoverable := v_recoverable + v_n;

  select count(*)::int into v_n
  from public.broki_tooling_movements tm
  join public.broki_unique_personnel_by_norm() up
    on up.norm_name = public.broki_norm_text(tm.tma_in)
  where tm.tma_in_person_id is null and public.broki_norm_text(tm.tma_in) is not null;
  v_recoverable := v_recoverable + v_n;

  select count(*)::int into v_n
  from public.broki_personnel p
  where p.auth_user_id is null
    and p.correo is not null
    and (
      select count(*) from auth.users u
      where lower(trim(u.email)) = lower(trim(p.correo))
    ) = 1;
  v_recoverable := v_recoverable + v_n;

  return jsonb_build_object(
    'ok', v_recoverable = 0,
    'recoverable_orphans', v_recoverable
  );
end;
$$;

revoke all on function public.broki_verify_relation_integrity() from public;
grant execute on function public.broki_verify_relation_integrity() to service_role;

-- Harden legacy linker: unique + unaccent only (no multi-match join)
create or replace function public.broki_normalize_legacy_links()
returns void
language plpgsql
as $$
begin
  update public.broki_incidents i
  set asset_id = ua.asset_id
  from public.broki_unique_asset_by_ident() ua
  where i.asset_id is null
    and public.broki_norm_code(i.id_objeto) = ua.norm_ident;

  update public.broki_incidents i
  set worker_id = up.person_id
  from public.broki_unique_personnel_by_norm() up
  where i.worker_id is null
    and public.broki_norm_text(i.trabajador_text) = up.norm_name;

  update public.broki_planner_groups g
  set aircraft_id = ua.aircraft_id
  from public.broki_unique_aircraft_by_norm() ua
  where g.aircraft_id is null
    and public.broki_norm_code(g.id_avion) = ua.norm_mat;

  update public.broki_planner_groups g
  set responsible_person_id = up.person_id
  from public.broki_unique_personnel_by_norm() up
  where g.responsible_person_id is null
    and public.broki_norm_text(g.responsable) = up.norm_name;

  update public.broki_planner_groups g
  set vehicle_asset_id = ua.asset_id
  from public.broki_unique_asset_by_ident() ua
  where g.vehicle_asset_id is null
    and public.broki_norm_code(g.vehiculo) = ua.norm_ident;

  update public.broki_planner_group_members m
  set person_id = up.person_id
  from public.broki_unique_personnel_by_norm() up
  where m.person_id is null
    and public.broki_norm_text(m.worker_text) = up.norm_name;

  update public.broki_planner_tasks t
  set aircraft_id = ua.aircraft_id
  from public.broki_unique_aircraft_by_norm() ua
  where t.aircraft_id is null
    and public.broki_norm_code(t.matricula_avion) = ua.norm_mat;

  update public.broki_planner_tasks t
  set group_id = g.id
  from public.broki_planner_groups g
  where t.group_id is null
    and t.grupo_trabajo_external_id is not null
    and g.source_system = t.source_system
    and g.external_id = t.grupo_trabajo_external_id;

  update public.broki_tooling_movements tm
  set tool_id = tc.id
  from public.broki_tooling_catalog tc
  where tm.tool_id is null
    and public.broki_norm_code(tm.bac_bact) = public.broki_norm_code(tc.bac_bact)
    and (
      select count(*) from public.broki_tooling_catalog x
      where public.broki_norm_code(x.bac_bact) = public.broki_norm_code(tm.bac_bact)
    ) = 1;

  update public.broki_tooling_movements tm
  set aircraft_id = ua.aircraft_id
  from public.broki_unique_aircraft_by_norm() ua
  where tm.aircraft_id is null
    and public.broki_norm_code(tm.avion) = ua.norm_mat;

  update public.broki_tooling_movements tm
  set tma_out_person_id = up.person_id
  from public.broki_unique_personnel_by_norm() up
  where tm.tma_out_person_id is null
    and public.broki_norm_text(tm.tma_out) = up.norm_name;

  update public.broki_tooling_movements tm
  set tma_in_person_id = up.person_id
  from public.broki_unique_personnel_by_norm() up
  where tm.tma_in_person_id is null
    and public.broki_norm_text(tm.tma_in) = up.norm_name;

  update public.broki_assets ast
  set aircraft_id = ua.aircraft_id,
      aircraft_registration_snapshot = coalesce(ast.aircraft_registration_snapshot, ast.avion_text)
  from public.broki_unique_aircraft_by_norm() ua
  where ast.aircraft_id is null
    and public.broki_norm_code(ast.avion_text) = ua.norm_mat;

  update public.broki_assets ast
  set current_worker_id = up.person_id,
      worker_name_snapshot = coalesce(ast.worker_name_snapshot, ast.current_worker_text)
  from public.broki_unique_personnel_by_norm() up
  where ast.current_worker_id is null
    and public.broki_norm_text(ast.current_worker_text) = up.norm_name;

  update public.broki_communications c
  set person_id = p.id
  from public.broki_personnel p
  where c.person_id is null
    and c.telefono is not null
    and p.telefono = c.telefono
    and (
      select count(*) from public.broki_personnel x where x.telefono = c.telefono
    ) = 1;
end;
$$;
