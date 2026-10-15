-- Fix: set-returning function must be called with ().

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
  r record;
  v_id uuid;
  v_class text;
  v_reason text;
begin
  if not p_dry_run then
    update public.broki_assets
    set
      worker_name_snapshot = coalesce(worker_name_snapshot, current_worker_text),
      aircraft_registration_snapshot = coalesce(aircraft_registration_snapshot, avion_text)
    where (current_worker_text is not null and worker_name_snapshot is null)
       or (avion_text is not null and aircraft_registration_snapshot is null);
  end if;

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

  for r in
    select a.id, a.current_worker_text, a.current_worker_id, a.avion_text, a.aircraft_id
    from public.broki_assets a
  loop
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

  for r in
    select i.id, i.id_objeto, i.asset_id, i.trabajador_text, i.worker_id, i.aircraft_id, i.planner_task_id
    from public.broki_incidents i
  loop
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

  for r in
    select g.id, g.id_avion, g.aircraft_id, g.vehiculo, g.vehicle_asset_id,
           g.responsable, g.responsible_person_id
    from public.broki_planner_groups g
  loop
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

  for r in
    select tm.id, tm.bac_bact, tm.tool_id, tm.tma_out, tm.tma_out_person_id,
           tm.tma_in, tm.tma_in_person_id, tm.avion, tm.aircraft_id
    from public.broki_tooling_movements tm
  loop
    if r.tool_id is null then
      select tc.id into v_id
      from public.broki_tooling_catalog tc
      where public.broki_norm_code(tc.bac_bact) = public.broki_norm_code(r.bac_bact);
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
