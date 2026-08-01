import type { WorkGroup, WorkTask } from "@/lib/types/equipment";

const uc = (s: unknown): string => String(s ?? "").trim();

const normalizeMat = (s: unknown): string =>
  uc(s).toUpperCase().replace(/[^A-Z0-9]/g, "");

function isSameCalendarDay(dateRef: unknown): boolean {
  if (typeof dateRef !== "string" || !dateRef) return false;
  const d = new Date(dateRef);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

/** Loosely typed row as it arrives from an Edge Function. */
type PlannerRow = Record<string, unknown>;

export function mergePlannerData(
  rawGroups: PlannerRow[],
  rawTasks: PlannerRow[]
): WorkGroup[] {
  if (!Array.isArray(rawGroups)) return [];
  const safeTasks = Array.isArray(rawTasks) ? rawTasks : [];

  const uniqueGroupsMap = new Map<string, PlannerRow>();

  const sortedGroups = [...rawGroups].sort(
    (a, b) => Number(b.id ?? 0) - Number(a.id ?? 0),
  );

  sortedGroups.forEach((g) => {
    const rawMat = g.id_avion || g.matricula || "";
    const mat = normalizeMat(rawMat);
    if (!mat) return;

    const dateRef = g.fecha_modificacion || g.created_at;
    if (!isSameCalendarDay(dateRef)) return;

    const existing = uniqueGroupsMap.get(mat);
    const candidate: PlannerRow = { ...g, _cleanMat: mat, _displayMat: rawMat };

    if (existing) {
      if (Number(existing.id) <= Number(g.id)) {
        if (!candidate.hora_llegada && existing.hora_llegada)
          candidate.hora_llegada = existing.hora_llegada;
        if (!candidate.hora_salida && existing.hora_salida)
          candidate.hora_salida = existing.hora_salida;
        uniqueGroupsMap.set(mat, candidate);
      }
    } else {
      uniqueGroupsMap.set(mat, candidate);
    }
  });

  return Array.from(uniqueGroupsMap.values()).map((g) => {
    const mat = g._cleanMat as string;

    const workers: string[] = [];
    if (Array.isArray(g.members)) {
      for (const m of g.members as PlannerRow[]) {
        const w = m.worker_text;
        if (w) workers.push(uc(w));
      }
    } else {
      for (let i = 1; i <= 10; i++) {
        const w = g[`trabajador_${i}`];
        if (w) workers.push(uc(w));
      }
    }

    const uniqueTasksMap = new Map<string, WorkTask>();
    safeTasks
      .filter((t) => {
        const tMat = normalizeMat(t.matricula_avion || t.matricula || t.id_avion);
        return tMat === mat && isSameCalendarDay(t.fecha);
      })
      .forEach((t) => {
        const key =
          t.codigo && t.codigo !== "null" ? String(t.codigo) : uc(t.descripcion);
        uniqueTasksMap.set(key, {
          db_id: String(t.id ?? ""),
          type: uc(t.tipo_tarea),
          code: uc(t.codigo),
          priority: uc(t.prioridad) || "NORMAL",
          desc: uc(t.descripcion),
          notes: uc(t.notas),
          done: Number(t.estado) === 1,
        });
      });

    return {
      id: String(g.id ?? ""),
      matricula: uc(g._displayMat).toUpperCase(),
      modelo: uc(g.modelo),
      aerolinea: uc(g.aerolinea),
      salida: uc(g.hora_salida),
      responsable: uc(g.responsable),
      furgo: uc(g.vehiculo),
      workers,
      tasks: Array.from(uniqueTasksMap.values()),
    } satisfies WorkGroup;
  });
}
