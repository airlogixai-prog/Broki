import type { ToolingCatalogRow, ToolingMovementRow } from "@/lib/api/canonical";

const str = (...values: unknown[]): string => {
  for (const v of values) {
    if (v !== null && v !== undefined && v !== "") return String(v).trim();
  }
  return "";
};

/** Vista UI del catálogo tooling — solo columnas canónicas P0 (+ familia fallback). */
export interface ToolCatalogView {
  bac: string;
  description: string;
  tipo: string;
  supplier: string;
  manufacturer: string;
  ubicacion: string;
  estado: string;
  partNumber: string;
  serialNumber: string;
}

export interface ToolMovementView {
  id: string;
  bac: string;
  description: string;
  checkoutPerson: string;
  checkoutDate: string;
  aircraft: string;
  checkoutNotes: string;
  checkoutCondition: string;
  checkinPerson: string | null;
  checkinDate: string | null;
  checkinNotes: string | null;
  checkinCondition: string | null;
  status: "checked_out" | "returned";
}

export type ToolAvailability = "available" | "checked_out" | "unserviceable" | "unknown";

/** Catalog status (SERVICEABLE / U-S / Disponible…) → availability bucket; an open movement overrides. */
export function toolAvailability(tool: ToolCatalogView, openMovement: boolean): ToolAvailability {
  const s = tool.estado.toUpperCase();
  if (/U\/?S|UNSERV|INOPER|BAJA|FUERA/.test(s)) return "unserviceable";
  if (openMovement) return "checked_out";
  if (!s || /SERVIC|DISPON|OPERATIV|OK/.test(s)) return "available";
  return "unknown";
}

/**
 * Canonical columns first. raw_payload only as last-resort for non-P0 legacy
 * extras (rango/notas) — never as primary source for tipo/supplier/etc.
 */
export function normalizeToolingCatalog(item: ToolingCatalogRow): ToolCatalogView {
  return {
    bac: str(item.bac_bact),
    description: str(item.descripcion) || "Sin descripción",
    tipo: str(item.tipo, item.familia),
    supplier: str(item.supplier),
    manufacturer: str(item.manufacturer),
    ubicacion: str(item.ubicacion_habitual),
    estado: str(item.estado),
    partNumber: str(item.part_number, item.codigo),
    serialNumber: str(item.serial_number),
  };
}

function splitRemarks(remarks: string | null | undefined): { out: string; in: string | null } {
  const raw = str(remarks);
  const i = raw.indexOf(" | ");
  if (i < 0) return { out: raw, in: null };
  return { out: raw.slice(0, i).trim(), in: raw.slice(i + 3).trim() || null };
}

export function normalizeToolingMovement(r: ToolingMovementRow): ToolMovementView {
  return {
    id: String(r.id ?? ""),
    bac: str(r.bac_bact),
    description: str(r.descripcion),
    checkoutPerson: str(r.tma_out),
    checkoutDate: str(r.date_out),
    aircraft: str(r.avion),
    // The checkin RPC appends its remarks as "out | in"; split so each side shows its own note.
    checkoutNotes: splitRemarks(r.remarks).out,
    checkoutCondition: str(r.complete_out),
    checkinPerson: str(r.tma_in) || null,
    checkinDate: str(r.date_in) || null,
    checkinNotes: r.date_in ? splitRemarks(r.remarks).in : null,
    checkinCondition: str(r.complete_in) || null,
    status: r.date_in ? "returned" : "checked_out",
  };
}
