/**
 * Mirrors planner-tasks dedup selection (broki_planner_tasks_dedup_idx).
 */

export type TareaRawRow = {
  source_system: string;
  external_id: string;
  row_data: Record<string, unknown>;
  synced_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

function firstText(row: Record<string, unknown>, keys: string[]): string | null {
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

export function plannerMatKey(matricula: string | null | undefined): string {
  return String(matricula ?? "").toUpperCase().replace(/[^A-Za-z0-9]/g, "");
}

export function tareaBusinessKey(row: TareaRawRow): string {
  const codigo = firstText(row.row_data, ["codigo", "CODIGO"]);
  const fecha = parseTs(
    firstText(row.row_data, ["fecha", "FECHA"]) ?? row.row_data.fecha,
  );
  if (codigo != null && fecha != null) {
    const mat = firstText(row.row_data, [
      "matricula_avion",
      "MATRICULA_AVION",
      "matricula",
      "MATRICULA",
    ]);
    const day = new Date(fecha).toISOString().slice(0, 10);
    return `${plannerMatKey(mat)}|${codigo}|${day}`;
  }
  return `id:${row.source_system}:${row.external_id}`;
}

export function tareaEventAt(row: TareaRawRow): number | null {
  for (const key of [
    "fecha_modificacion",
    "FECHA_MODIFICACION",
    "updatedAt",
    "updated_at",
    "fecha",
    "FECHA",
  ]) {
    const t = parseTs(row.row_data[key]);
    if (t != null) return t;
  }
  return parseTs(row.synced_at) ?? parseTs(row.updated_at) ??
    parseTs(row.created_at);
}

export function selectPlannerTasks(rows: TareaRawRow[]): TareaRawRow[] {
  const groups = new Map<string, TareaRawRow[]>();
  for (const row of rows) {
    const key = tareaBusinessKey(row);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  const out: TareaRawRow[] = [];
  for (const [, group] of groups) {
    group.sort((a, b) => {
      const ea = tareaEventAt(a);
      const eb = tareaEventAt(b);
      if (ea != null && eb != null && ea !== eb) return eb - ea;
      if (ea != null && eb == null) return -1;
      if (ea == null && eb != null) return 1;
      return a.external_id.localeCompare(b.external_id);
    });
    out.push(group[0]);
  }
  return out;
}

if (import.meta.main) {
  const rows: TareaRawRow[] = [
    {
      source_system: "n8n_postgres_pro",
      external_id: "old",
      row_data: {
        codigo: "14212",
        matricula_avion: "EC-NTB",
        fecha: "2025-12-31T12:00:00Z",
        fecha_modificacion: "2025-01-01T00:00:00Z",
      },
    },
    {
      source_system: "n8n_postgres_pro",
      external_id: "new",
      row_data: {
        codigo: "14212",
        matricula: "ECNTB",
        fecha: "2025-12-31T18:00:00Z",
        fecha_modificacion: "2025-06-01T00:00:00Z",
      },
    },
  ];
  console.assert(tareaBusinessKey(rows[0]) === tareaBusinessKey(rows[1]));
  const sel = selectPlannerTasks(rows);
  console.assert(sel.length === 1 && sel[0].external_id === "new");
  console.log("planner-normalize self-check OK");
}
