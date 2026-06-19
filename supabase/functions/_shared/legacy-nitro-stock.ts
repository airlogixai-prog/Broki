// Shape converters: broki_nitro_stock <-> legacy n8n nitro_stock row.
// Consumer: stock/page.tsx — reads cantida_de_botellas_llenas (typo preserved) and
// cantidad_de_botellas_vacias.

export type NitroStockRow = Record<string, unknown>;

export function nitroStockToLegacyRow(row: NitroStockRow): Record<string, unknown> {
  return {
    id: row.external_id,
    ubicacion: row.ubicacion,
    // ponytail: typo preserved intentionally — stock/page.tsx reads this exact key
    cantida_de_botellas_llenas: row.botellas_llenas ?? 0,
    cantidad_de_botellas_vacias: row.botellas_vacias ?? 0,
  };
}

export function normalizeUbicacion(loc: string): string {
  return String(loc ?? "").toLowerCase().trim();
}
