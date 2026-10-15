import type { WorkGroup, WorkTask } from "@/lib/types/equipment";

const uc = (s: unknown): string => String(s ?? "").trim();

const normalizeMat = (s: unknown): string => uc(s).toUpperCase().replace(/[^A-Z0-9]/g, "");

/** YYYY-MM-DD of a date in local time (the planner is a local-day board). */
export function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayOf(dateRef: unknown): string | null {
  if (typeof dateRef !== "string" || !dateRef) return null;
  const d = new Date(dateRef);
  if (Number.isNaN(d.getTime())) return null;
  return localDayKey(d);
}

type GroupMerge = {
  id?: string | number;
  id_avion?: string | null;
  aircraft_id?: string | null;
  modelo?: string | null;
  aerolinea?: string | null;
  vehiculo?: string | null;
  vehicle_asset_id?: string | null;
  responsable?: string | null;
  responsible_person_id?: string | null;
  hora_llegada?: string | null;
  hora_salida?: string | null;
  destino?: string | null;
  fecha_modificacion?: string | null;
  created_at?: string | null;
  members?: Array<{ worker_text?: string | null; person_id?: string | null }>;
  matricula?: string | null;
  trabajador_1?: string;
  trabajador_2?: string;
  trabajador_3?: string;
  trabajador_4?: string;
  trabajador_5?: string;
  trabajador_6?: string;
  trabajador_7?: string;
  trabajador_8?: string;
  trabajador_9?: string;
  trabajador_10?: string;
};

type TaskLike = {
  id?: string | number;
  group_id?: string | null;
  tipo_tarea?: string | null;
  codigo?: string | null;
  matricula_avion?: string | null;
  aircraft_id?: string | null;
  prioridad?: string | null;
  descripcion?: string | null;
  notas?: string | null;
  estado?: number | null;
  fecha?: string | null;
  matricula?: string | null;
  id_avion?: string | null;
};

export interface MergeOptions {
  /** Local day to show (YYYY-MM-DD). Defaults to today. */
  day?: string;
}

/**
 * Builds the board for one day: one group per aircraft (the newest row wins,
 * older rows fill missing hours) and its tasks.
 *
 * Tasks are linked by `group_id` first and by aircraft+day as a fallback for
 * legacy rows without a link. Each DB row is one task: two tasks that share a
 * description are both shown (the legacy board collapsed them).
 */
export function mergePlannerData(rawGroups: GroupMerge[], rawTasks: TaskLike[], options: MergeOptions = {}): WorkGroup[] {
  if (!Array.isArray(rawGroups)) return [];
  const safeTasks = Array.isArray(rawTasks) ? rawTasks : [];
  const day = options.day ?? localDayKey(new Date());

  const byMat = new Map<string, { row: GroupMerge; mat: string; displayMat: string; ids: Set<string> }>();

  const sortedGroups = [...rawGroups].sort((a, b) => {
    const ta = Date.parse(String(a.fecha_modificacion ?? a.created_at ?? "")) || 0;
    const tb = Date.parse(String(b.fecha_modificacion ?? b.created_at ?? "")) || 0;
    return tb - ta;
  });

  for (const row of sortedGroups) {
    const rawMat = row.id_avion || row.matricula || "";
    const mat = normalizeMat(rawMat);
    if (!mat) continue;
    if (dayOf(row.fecha_modificacion || row.created_at) !== day) continue;

    const existing = byMat.get(mat);
    if (existing) {
      // Newest row already chosen; older duplicates only contribute missing hours and their task links.
      if (!existing.row.hora_llegada && row.hora_llegada) existing.row.hora_llegada = row.hora_llegada;
      if (!existing.row.hora_salida && row.hora_salida) existing.row.hora_salida = row.hora_salida;
      if (row.id != null) existing.ids.add(String(row.id));
      continue;
    }
    byMat.set(mat, { row: { ...row }, mat, displayMat: uc(rawMat), ids: new Set(row.id != null ? [String(row.id)] : []) });
  }

  return Array.from(byMat.values()).map(({ row: g, mat, displayMat, ids }) => {
    const workers: string[] = [];
    if (Array.isArray(g.members) && g.members.length > 0) {
      for (const m of g.members) if (m.worker_text) workers.push(uc(m.worker_text));
    } else {
      for (let i = 1; i <= 10; i++) {
        const w = g[`trabajador_${i}` as keyof GroupMerge];
        if (w) workers.push(uc(w));
      }
    }

    const tasks: WorkTask[] = [];
    const seen = new Set<string>();
    for (const t of safeTasks) {
      const linked = t.group_id != null && ids.has(String(t.group_id));
      const tMat = normalizeMat(t.matricula_avion || t.matricula || t.id_avion);
      const sameDay = dayOf(t.fecha) === day;
      if (!linked && !(tMat === mat && sameDay)) continue;
      const key = t.id != null ? String(t.id) : `${uc(t.codigo)}|${uc(t.descripcion)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      tasks.push({
        db_id: t.id != null ? String(t.id) : "",
        type: uc(t.tipo_tarea),
        code: uc(t.codigo),
        priority: uc(t.prioridad) || "NORMAL",
        desc: uc(t.descripcion),
        notes: uc(t.notas),
        done: Number(t.estado) === 1,
      });
    }

    return {
      id: String(g.id ?? ""),
      matricula: displayMat.toUpperCase(),
      modelo: uc(g.modelo),
      aerolinea: uc(g.aerolinea),
      salida: uc(g.hora_salida),
      llegada: uc(g.hora_llegada) || uc(g.destino),
      responsable: uc(g.responsable),
      furgo: uc(g.vehiculo),
      workers,
      tasks,
    } satisfies WorkGroup;
  });
}
