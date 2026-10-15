import type { NitroStockRow } from "../api/canonical.ts";

/** Canonical nitro row + legacy typo aliases still present in some payloads. */
export type StockRow = NitroStockRow & {
  cantida_de_botellas_llenas?: number | string | null;
  cantidad_de_botellas_llenas?: number | string | null;
  cantidad_de_botellas_vacias?: number | string | null;
  updated_at?: string | null;
};

export interface StockLocation {
  /** Lower-cased ubicacion, the upsert key on the server. */
  key: string;
  label: string;
  full: number;
  empty: number;
}

const asCount = (value: unknown): number => {
  const n = parseInt(String(value ?? ""), 10);
  return Number.isNaN(n) ? 0 : n;
};

/** Human label for a location key ("t1,2,3" → "T1, T2, T3"). */
export function locationLabel(key: string): string {
  const k = key.trim().toLowerCase();
  if (/^t\d(,\d)+$/.test(k)) return k.split(",").map((p, i) => (i === 0 ? p.toUpperCase() : `T${p}`)).join(", ");
  return key.toUpperCase();
}

/**
 * One location per distinct `ubicacion` (case-insensitive). If the server ever
 * returns two rows for the same key the newest `updated_at` wins; counts are
 * never summed across rows.
 */
export function rowsToLocations(rows: StockRow[]): StockLocation[] {
  const byKey = new Map<string, { loc: StockLocation; at: number }>();
  for (const row of rows) {
    const key = String(row.ubicacion ?? "").trim().toLowerCase();
    if (!key) continue;
    const at = Date.parse(String(row.updated_at ?? "")) || 0;
    const loc: StockLocation = {
      key,
      label: locationLabel(key),
      full: asCount(row.botellas_llenas ?? row.cantida_de_botellas_llenas ?? row.cantidad_de_botellas_llenas),
      empty: asCount(row.botellas_vacias ?? row.cantidad_de_botellas_vacias),
    };
    const prev = byKey.get(key);
    if (!prev || at >= prev.at) byKey.set(key, { loc, at });
  }
  return [...byKey.values()].map((v) => v.loc).sort((a, b) => a.key.localeCompare(b.key));
}

export interface CountErrors {
  full?: string;
  empty?: string;
}

/** Integers ≥ 0 only; returns field messages. */
export function validateCounts(draft: { full: string; empty: string }): CountErrors {
  const check = (raw: string) => {
    if (raw.trim() === "") return "Obligatorio";
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) return "Entero ≥ 0";
    if (n > 9999) return "Máx. 9999";
    return undefined;
  };
  const errors: CountErrors = {};
  const f = check(draft.full);
  const e = check(draft.empty);
  if (f) errors.full = f;
  if (e) errors.empty = e;
  return errors;
}
