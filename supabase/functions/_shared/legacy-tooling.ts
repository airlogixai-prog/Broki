// Shape converters: broki_tooling_* <-> legacy n8n tooling rows.
// Consumer: tooling/page.tsx — reads { catalog: ToolItem[], movements: ToolMovement[] }.

export type CatalogRow = Record<string, unknown>;
export type MovementRow = Record<string, unknown>;

export function catalogToLegacyRow(row: CatalogRow): Record<string, unknown> {
  const raw = (row.raw_payload ?? {}) as Record<string, unknown>;
  return {
    id: row.legacy_id ?? row.external_id,
    identificador: row.bac_bact,
    bac: row.bac_bact,
    bac_bact: row.bac_bact,
    descripcion: row.descripcion ?? "",
    tipo_tool: row.familia ?? "",
    ubicacion_habitual: raw.ubicacion_habitual ?? raw.ubicacion ?? "",
    estado: row.estado ?? "",
    part_number: row.codigo ?? raw.part_number ?? "",
    serial_number: raw.serial_number ?? "",
    rango: raw.rango ?? "",
    notas: raw.notas ?? "",
  };
}

export function movementToLegacyRow(row: MovementRow): Record<string, unknown> {
  return {
    id: row.legacy_id ?? row.external_id,
    bac_bact: row.bac_bact,
    bac: row.bac_bact,
    descripcion: row.descripcion ?? "",
    tma_out: row.tma_out ?? "",
    date_out: row.date_out ?? null,
    avion: row.avion ?? "",
    remarks: row.remarks ?? "",
    tma_in: row.tma_in ?? null,
    date_in: row.date_in ?? null,
  };
}
