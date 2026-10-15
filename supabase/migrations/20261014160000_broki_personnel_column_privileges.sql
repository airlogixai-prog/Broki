-- Personnel PII (phone, e-mail, chat id, raw payload) must not be readable by
-- dashboard users through PostgREST, whatever their role. The RLS policy keeps
-- gating rows; column-level privileges hide the sensitive columns. Edge
-- Functions use service_role and are unaffected (personnel-list strips PII itself).
-- Non-destructive: privileges only.

revoke select on table public.broki_personnel from authenticated;
grant select (
  id, source_system, source_table, external_id, legacy_id,
  nombre, cod_empleado_aena, estado, fecha_alta, fecha_baja, fecha_modificacion,
  helper, cat_a, b1, b2, certificador, n_bac,
  a_a320_family, a_airbus_a330, a_airbus_a350, a_boeing_737, a_boeing_787, a_boeing_777,
  a_atr_42_72, a_embraer_e_jet, a_bombardier_crj, a_otros,
  b1_a320_family, b1_airbus_a330, b1_airbus_a350, b1_boeing_737, b1_boeing_787, b1_boeing_777,
  b1_atr_42_72, b1_embraer_e_jet, b1_bombardier_crj, b1_otros,
  b2_a320_family, b2_airbus_a330, b2_airbus_a350, b2_boeing_737, b2_boeing_787, b2_boeing_777,
  b2_atr_42_72, b2_embraer_e_jet, b2_bombardier_crj, b2_otros,
  synced_at, created_at, updated_at
) on table public.broki_personnel to authenticated;
