/**
 * Mirrors SQL selection rules for broki_normalize_nitro_stock.
 * Offline unit tests — DB path exercised after migration apply on staging.
 */

export type NitroRawRow = {
  external_id: string;
  row_data: Record<string, unknown>;
  synced_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type NitroCanonical = {
  external_id: string;
  ubicacion: string;
  botellas_llenas: number | null;
  botellas_vacias: number | null;
  raw_payload: Record<string, unknown>;
  synced_at: string | null;
  event_at: string | null;
};

const UBICACION_KEYS = ["ubicacion", "UBICACION", "location", "LOCATION"] as const;
const LLENAS_KEYS = [
  "cantida_de_botellas_llenas",
  "cantidad_de_botellas_llenas",
  "botellas_llenas",
] as const;
const VACIAS_KEYS = [
  "cantidad_de_botellas_vacias",
  "cantida_de_botellas_vacias",
  "botellas_vacias",
] as const;
const EVENT_KEYS = [
  "updatedAt",
  "updated_at",
  "UPDATED_AT",
  "fecha_modificacion",
  "FECHA_MODIFICACION",
  "createdAt",
  "created_at",
  "CREATED_AT",
] as const;

function firstText(
  row: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    if (!(key in row)) continue;
    const v = row[key];
    if (v == null) continue;
    const s = String(v).trim();
    if (s !== "") return s;
  }
  return null;
}

function parseTs(value: unknown): number | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

export function nitroUbicacionDisplay(
  rowData: Record<string, unknown>,
  externalId: string,
): string {
  return firstText(rowData, UBICACION_KEYS) ?? externalId ?? "unknown";
}

export function nitroUbicacionKey(
  rowData: Record<string, unknown>,
  externalId: string,
): string {
  return nitroUbicacionDisplay(rowData, externalId).toLowerCase();
}

export function nitroRowEventAt(row: NitroRawRow): number | null {
  for (const key of EVENT_KEYS) {
    const t = parseTs(row.row_data[key]);
    if (t != null) return t;
  }
  return parseTs(row.synced_at) ?? parseTs(row.updated_at) ??
    parseTs(row.created_at);
}

function toInt(row: Record<string, unknown>, keys: readonly string[]): number | null {
  const s = firstText(row, keys);
  if (s == null) return null;
  const n = Number(s);
  return Number.isInteger(n) ? n : null;
}

/** Select one canonical candidate per ubicacion_key (newest, then external_id). */
export function selectNitroCanonical(
  rows: NitroRawRow[],
): NitroCanonical[] {
  const groups = new Map<string, NitroRawRow[]>();
  for (const row of rows) {
    const key = nitroUbicacionKey(row.row_data, row.external_id);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const out: NitroCanonical[] = [];
  for (const [, group] of groups) {
    group.sort((a, b) => {
      const ea = nitroRowEventAt(a);
      const eb = nitroRowEventAt(b);
      if (ea != null && eb != null && ea !== eb) return eb - ea;
      if (ea != null && eb == null) return -1;
      if (ea == null && eb != null) return 1;
      return a.external_id.localeCompare(b.external_id);
    });
    const win = group[0];
    const eventAt = nitroRowEventAt(win);
    out.push({
      external_id: win.external_id,
      ubicacion: nitroUbicacionDisplay(win.row_data, win.external_id),
      botellas_llenas: toInt(win.row_data, LLENAS_KEYS),
      botellas_vacias: toInt(win.row_data, VACIAS_KEYS),
      raw_payload: win.row_data,
      synced_at: win.synced_at ?? null,
      event_at: eventAt != null ? new Date(eventAt).toISOString() : null,
    });
  }
  return out;
}

/** Stale guard: older candidate must not replace newer canonical. */
export function shouldUpdateCanonical(
  existingEventAt: number | null,
  incomingEventAt: number | null,
): boolean {
  if (incomingEventAt == null || existingEventAt == null) return true;
  return incomingEventAt >= existingEventAt;
}

if (import.meta.main) {
  const rows: NitroRawRow[] = [
    {
      external_id: "old",
      row_data: { ubicacion: "T4S", updatedAt: "2020-01-01T00:00:00Z", botellas_llenas: 1 },
    },
    {
      external_id: "new",
      row_data: { ubicacion: "t4S", updatedAt: "2024-06-01T00:00:00Z", botellas_llenas: 9 },
    },
  ];
  const selected = selectNitroCanonical(rows);
  console.assert(selected.length === 1);
  console.assert(selected[0].external_id === "new");
  console.assert(selected[0].raw_payload === rows[1].row_data);
  console.assert(nitroUbicacionKey({ ubicacion: " t4s " }, "x") === "t4s");
  console.assert(shouldUpdateCanonical(Date.parse("2024-01-01"), Date.parse("2023-01-01")) === false);
  console.assert(nitroRowEventAt({
    external_id: "e",
    row_data: { updatedAt: "not-a-date", createdAt: "2022-01-01T00:00:00Z" },
  }) === Date.parse("2022-01-01T00:00:00Z"));
  console.log("nitro-normalize self-check OK");
}
