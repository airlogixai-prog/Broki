/**
 * Pure helpers for broki-import-batch V3.
 * Kept free of Deno.serve / Supabase so unit tests stay offline.
 */

export const BATCH_MAX = 1000;

export const ID_KEYS = [
  "external_id",
  "id",
  "identificador",
  "brk",
  "codigo",
  "id_incidencia",
  "cod_empleado_aena",
  "telefono",
  "matricula",
  "session_id",
] as const;

export type LegacyRow = Record<string, unknown>;
export type ImportItem = { external_id?: string; row_data?: LegacyRow } & LegacyRow;

export type ImportBody = {
  migration_id: string;
  source_system: string;
  source_schema?: string;
  source_table: string;
  batch_index: number;
  total_batches: number;
  total_rows: number;
  items: ImportItem[];
};

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${
    Object.keys(obj).sort().map((key) =>
      `${JSON.stringify(key)}:${stableStringify(obj[key])}`
    ).join(",")
  }}`;
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function resolveExternalId(item: LegacyRow): string | null {
  for (const key of ID_KEYS) {
    const value = item[key];
    if (value != null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return null;
}

/** Separates technical external_id from original PostgreSQL row_data. */
export function unwrapItem(
  item: ImportItem,
): { externalId: string | null; rowData: LegacyRow } {
  const nested = item.row_data;
  const hasNested = nested && typeof nested === "object" && !Array.isArray(nested);
  const rowData = hasNested ? nested as LegacyRow : item;
  // Wrapper external_id wins; never written into row_data by the importer.
  const fromWrapper = hasNested && item.external_id != null &&
      String(item.external_id).trim() !== ""
    ? String(item.external_id).trim()
    : null;
  const externalId = fromWrapper ?? resolveExternalId(rowData);
  return { externalId, rowData };
}

/**
 * Assigns deterministic #dup:N suffixes for colliding base ids within one table extract.
 * Sort key: stable hash of row_data, then base id, then original index (ctid stand-in).
 */
export function assignDuplicateExternalIds(
  rows: Array<{ baseId: string; rowData: LegacyRow; orderHint?: string }>,
): string[] {
  const indexed = rows.map((row, index) => ({
    ...row,
    index,
    contentKey: stableStringify(row.rowData),
  }));

  const groups = new Map<string, typeof indexed>();
  for (const row of indexed) {
    const list = groups.get(row.baseId) ?? [];
    list.push(row);
    groups.set(row.baseId, list);
  }

  const result = new Array<string>(rows.length);
  for (const [baseId, group] of groups) {
    if (group.length === 1) {
      result[group[0].index] = baseId;
      continue;
    }
    group.sort((a, b) =>
      a.contentKey.localeCompare(b.contentKey) ||
      (a.orderHint ?? "").localeCompare(b.orderHint ?? "") ||
      a.index - b.index
    );
    group.forEach((row, dupIndex) => {
      result[row.index] = `${baseId}#dup:${dupIndex + 1}`;
    });
  }
  return result;
}

export function validateImportBody(
  body: unknown,
): { ok: true; body: ImportBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "invalid_body" };
  }
  const b = body as Record<string, unknown>;
  if (
    typeof b.migration_id !== "string" || !b.migration_id ||
    typeof b.source_system !== "string" || !b.source_system ||
    typeof b.source_table !== "string" || !b.source_table ||
    !Array.isArray(b.items) ||
    !Number.isInteger(b.batch_index) ||
    !Number.isInteger(b.total_batches) ||
    !Number.isInteger(b.total_rows)
  ) {
    return { ok: false, error: "invalid_body" };
  }
  const batchIndex = b.batch_index as number;
  const totalBatches = b.total_batches as number;
  const totalRows = b.total_rows as number;
  if (
    batchIndex < 0 || totalBatches < 1 || batchIndex >= totalBatches ||
    totalRows < 0
  ) {
    return { ok: false, error: "invalid_body" };
  }
  if ((b.items as unknown[]).length > BATCH_MAX) {
    return { ok: false, error: "batch_too_large" };
  }
  return {
    ok: true,
    body: {
      migration_id: b.migration_id,
      source_system: b.source_system,
      source_schema: typeof b.source_schema === "string"
        ? b.source_schema
        : undefined,
      source_table: b.source_table,
      batch_index: batchIndex,
      total_batches: totalBatches,
      total_rows: totalRows,
      items: b.items as ImportItem[],
    },
  };
}

// ponytail: fails if unwrap / dup suffix / stable stringify break
if (import.meta.main) {
  const nested = unwrapItem({ external_id: "x", row_data: { id: 1, value: "ok" } });
  console.assert(nested.externalId === "x");
  console.assert(nested.rowData.id === 1);
  console.assert(!("external_id" in nested.rowData));

  const flat = unwrapItem({ id: "42", nombre: "a" });
  console.assert(flat.externalId === "42");
  console.assert(flat.rowData.nombre === "a");

  console.assert(stableStringify({ b: 1, a: 2 }) === '{"a":2,"b":1}');

  const dups = assignDuplicateExternalIds([
    { baseId: "same", rowData: { v: 2 } },
    { baseId: "same", rowData: { v: 1 } },
    { baseId: "unique", rowData: { v: 9 } },
  ]);
  console.assert(dups[0] === "same#dup:2", dups[0]); // v:2 sorts after v:1
  console.assert(dups[1] === "same#dup:1", dups[1]);
  console.assert(dups[2] === "unique");

  const identical = assignDuplicateExternalIds([
    { baseId: "x", rowData: { a: 1 }, orderHint: "b" },
    { baseId: "x", rowData: { a: 1 }, orderHint: "a" },
  ]);
  console.assert(identical[0] === "x#dup:2");
  console.assert(identical[1] === "x#dup:1");

  const noId = resolveExternalId({ foo: "bar" });
  console.assert(noId === null);

  const bad = validateImportBody({ source_table: "t", items: [] });
  console.assert(bad.ok === false);

  const good = validateImportBody({
    migration_id: "m1",
    source_system: "n8n_postgres_pro",
    source_table: "personal",
    batch_index: 0,
    total_batches: 1,
    total_rows: 0,
    items: [],
  });
  console.assert(good.ok === true);

  console.log("legacy-import self-check OK");
}
