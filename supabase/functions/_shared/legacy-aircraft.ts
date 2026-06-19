// Shape converters: broki_aircraft <-> legacy n8n aviones row.
// Consumer: normalizeAircraft() in web/src/lib/mappers/equipment.ts.

export type AircraftRow = Record<string, unknown>;

export function aircraftToLegacyRow(row: AircraftRow): Record<string, unknown> {
  return {
    id: row.matricula ?? row.external_id,
    matricula: row.matricula,
    modelo: row.modelo,
    aerolinea: row.aerolinea,
    estado: row.estado,
    registration: row.matricula,
  };
}
