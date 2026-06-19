// Shape converters: broki_assets <-> legacy n8n inventory row.
// The frontend uses normalizeFurgo() / normalizeGSE() from web/src/lib/mappers/equipment.ts
// which reads these exact field names.

export type AssetRow = Record<string, unknown>;

function assetKindToFamilia(kind: string): string {
  switch (kind) {
    case "van": return "FURGONETA";
    case "gse": return "GSE";
    case "nitro": return "NITROGENO";
    case "inventory": return "INVENTARIO";
    default: return "OTROS";
  }
}

function str(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

export function assetToLegacyRow(row: AssetRow): Record<string, unknown> {
  const familia =
    str(row.familia) ||
    assetKindToFamilia(str(row.asset_kind));

  return {
    id: row.identifier,
    identificador: row.identifier,
    descripcion: row.descripcion ?? row.nombre_equipo ?? "",
    vehiculo: row.descripcion ?? row.nombre_equipo ?? "",
    familia,
    matricula: row.matricula ?? "",
    plazas: row.plazas ?? "",
    estado: row.estado ?? "Disponible",
    ubicacion_habitual: row.ubicacion_habitual ?? "",
    parking: row.parking ?? "",
    avion: row.avion_text ?? "",
    trabajador: row.current_worker_text ?? "",
    trabajadores: row.current_worker_text ?? "",
    combustible: row.combustible != null ? String(row.combustible) : "",
    adblue: row.adblue != null ? String(row.adblue) : "",
    nitrogeno_1: row.nitrogeno_1 != null ? String(row.nitrogeno_1) : "",
    nitrogeno_2: row.nitrogeno_2 != null ? String(row.nitrogeno_2) : "",
    nitrogeno_3: row.nitrogeno_3 != null ? String(row.nitrogeno_3) : "",
    nitrogeno_4: row.nitrogeno_4 != null ? String(row.nitrogeno_4) : "",
    notas: row.notas ?? "",
    // pass-through raw fields for any old consumer that reads brk / brk_id
    brk: row.identifier,
    "BRK-ID": row.identifier,
  };
}

export function applyEquipmentUpdates(
  updates: Record<string, unknown>,
  type: string,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const isFurgo = type === "furgo" || type === "vehicle";

  if ("location" in updates) {
    if (isFurgo) {
      patch.parking = updates.location;
    } else {
      patch.ubicacion_habitual = updates.location;
      patch.parking = updates.location;
    }
  }
  if ("plane" in updates) patch.avion_text = updates.plane ?? null;
  if ("worker" in updates) patch.current_worker_text = updates.worker ?? null;
  if ("fuel" in updates) {
    const v = updates.fuel;
    patch.combustible = v === null || v === "" ? null : Number(v);
  }
  if ("status" in updates) patch.estado = updates.status ?? null;
  if ("notes" in updates) patch.notas = updates.notes ?? null;
  for (const n of ["nitrogeno_1", "nitrogeno_2", "nitrogeno_3", "nitrogeno_4"] as const) {
    if (n in updates) {
      const v = updates[n];
      patch[n] = v === null || v === "" ? null : Number(v);
    }
  }
  return patch;
}
