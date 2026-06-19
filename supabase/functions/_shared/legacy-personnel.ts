// Shape converters: broki_personnel <-> legacy n8n personal row.
// Consumer: normalizePersonnel() in web/src/lib/mappers/equipment.ts.

export type PersonnelRow = Record<string, unknown>;

export function personnelToLegacyRow(row: PersonnelRow): Record<string, unknown> {
  return {
    id: row.cod_empleado_aena ?? row.external_id ?? row.nombre,
    nombre: row.nombre,
    cod_empleado_aena: row.cod_empleado_aena,
    telefono: row.telefono,
    correo: row.correo,
    id_chat: row.id_chat,
    estado: row.estado,
    helper: row.helper,
    cat_a: row.cat_a,
    b1: row.b1,
    b2: row.b2,
    certificador: row.certificador,
    n_bac: row.n_bac,
    // aircraft type ratings a_*
    a_a320_family: row.a_a320_family,
    a_airbus_a330: row.a_airbus_a330,
    a_airbus_a350: row.a_airbus_a350,
    a_boeing_737: row.a_boeing_737,
    a_boeing_787: row.a_boeing_787,
    a_boeing_777: row.a_boeing_777,
    a_atr_42_72: row.a_atr_42_72,
    a_embraer_e_jet: row.a_embraer_e_jet,
    a_bombardier_crj: row.a_bombardier_crj,
    a_otros: row.a_otros,
    // b1_*
    b1_a320_family: row.b1_a320_family,
    b1_airbus_a330: row.b1_airbus_a330,
    b1_airbus_a350: row.b1_airbus_a350,
    b1_boeing_737: row.b1_boeing_737,
    b1_boeing_787: row.b1_boeing_787,
    b1_boeing_777: row.b1_boeing_777,
    b1_atr_42_72: row.b1_atr_42_72,
    b1_embraer_e_jet: row.b1_embraer_e_jet,
    b1_bombardier_crj: row.b1_bombardier_crj,
    b1_otros: row.b1_otros,
    // b2_*
    b2_a320_family: row.b2_a320_family,
    b2_airbus_a330: row.b2_airbus_a330,
    b2_airbus_a350: row.b2_airbus_a350,
    b2_boeing_737: row.b2_boeing_737,
    b2_boeing_787: row.b2_boeing_787,
    b2_boeing_777: row.b2_boeing_777,
    b2_atr_42_72: row.b2_atr_42_72,
    b2_embraer_e_jet: row.b2_embraer_e_jet,
    b2_bombardier_crj: row.b2_bombardier_crj,
    b2_otros: row.b2_otros,
  };
}
