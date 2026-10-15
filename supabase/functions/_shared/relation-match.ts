/**
 * Exact relation match helpers (Domain Data Architect / Fase 12).
 * No fuzzy. Accent-fold + trim + lower is allowed; Levenshtein / partial is not.
 * Ambiguous (2+ candidates) → MANUAL_REVIEW. Zero → HISTORICAL_UNRESOLVABLE.
 */

export type RelationClass =
  | "LINKED"
  | "MANUAL_REVIEW"
  | "HISTORICAL_UNRESOLVABLE"
  | "EMPTY";

export function foldText(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase();
}

export function foldCode(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase();
}

/** Unique map: key → id. Colliding keys are omitted (ambiguous). */
export function uniqueIndex(
  rows: ReadonlyArray<{ id: string; key: string | null | undefined }>,
  fold: (s: string) => string = foldText,
): Map<string, string> {
  const buckets = new Map<string, string[]>();
  for (const row of rows) {
    if (row.key == null || String(row.key).trim() === "") continue;
    const k = fold(String(row.key));
    if (!k) continue;
    const list = buckets.get(k) ?? [];
    list.push(row.id);
    buckets.set(k, list);
  }
  const out = new Map<string, string>();
  for (const [k, ids] of buckets) {
    const uniq = [...new Set(ids)];
    if (uniq.length === 1) out.set(k, uniq[0]!);
  }
  return out;
}

export function resolveExact(
  text: string | null | undefined,
  index: Map<string, string>,
  fold: (s: string) => string = foldText,
  ambiguousKeys?: Set<string>,
): { classification: RelationClass; id: string | null } {
  if (text == null || String(text).trim() === "") {
    return { classification: "EMPTY", id: null };
  }
  const k = fold(String(text));
  if (!k) return { classification: "EMPTY", id: null };
  const id = index.get(k) ?? null;
  if (id) return { classification: "LINKED", id };
  if (ambiguousKeys?.has(k)) {
    return { classification: "MANUAL_REVIEW", id: null };
  }
  return { classification: "HISTORICAL_UNRESOLVABLE", id: null };
}

/** Build ambiguous key set from raw rows (keys with 2+ distinct ids). */
export function ambiguousKeys(
  rows: ReadonlyArray<{ id: string; key: string | null | undefined }>,
  fold: (s: string) => string = foldText,
): Set<string> {
  const buckets = new Map<string, Set<string>>();
  for (const row of rows) {
    if (row.key == null || String(row.key).trim() === "") continue;
    const k = fold(String(row.key));
    if (!k) continue;
    const set = buckets.get(k) ?? new Set();
    set.add(row.id);
    buckets.set(k, set);
  }
  const out = new Set<string>();
  for (const [k, ids] of buckets) {
    if (ids.size > 1) out.add(k);
  }
  return out;
}

if (import.meta.main) {
  const people = [
    { id: "1", key: "José Núñez" },
    { id: "2", key: "Ana" },
    { id: "3", key: "Smoke" },
    { id: "4", key: "Smoke" },
  ];
  const idx = uniqueIndex(people);
  const amb = ambiguousKeys(people);
  const a = resolveExact("Jose Nunez", idx, foldText, amb);
  const b = resolveExact("Smoke", idx, foldText, amb);
  const c = resolveExact("BAYTON", idx, foldText, amb);
  const d = resolveExact("", idx, foldText, amb);
  const e = resolveExact("CS-TCF", uniqueIndex([{ id: "a1", key: "CS-TCF" }], foldCode), foldCode);
  console.assert(a.classification === "LINKED" && a.id === "1", "accent fold exact");
  console.assert(b.classification === "MANUAL_REVIEW", "ambiguous smoke");
  console.assert(c.classification === "HISTORICAL_UNRESOLVABLE", "no invent nickname");
  console.assert(d.classification === "EMPTY", "empty");
  console.assert(e.classification === "LINKED", "code exact");
  console.log("relation-match self-check ok");
}
