import type { WorkGroup, WorkTask } from "@/lib/types/equipment";

const uc = (s: unknown): string => String(s ?? "").trim();

const normalizeMat = (s: unknown): string =>
  uc(s).toUpperCase().replace(/[^A-Z0-9]/g, "");

function isSameCalendarDay(dateRef: string | null | undefined): boolean {
  if (!dateRef) return false;
  const d = new Date(dateRef);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

export function mergePlannerData(
  rawGroups: any[],
  rawTasks: any[]
): WorkGroup[] {
  if (!Array.isArray(rawGroups)) return [];
  const safeTasks = Array.isArray(rawTasks) ? rawTasks : [];

  const uniqueGroupsMap = new Map<string, any>();

  const sortedGroups = [...rawGroups].sort((a, b) => (b.id ?? 0) - (a.id ?? 0));

  sortedGroups.forEach((g) => {
    const rawMat = g.id_avion || g.matricula || "";
    const mat = normalizeMat(rawMat);
    if (!mat) return;

    const dateRef = g.fecha_modificacion || g.created_at;
    if (!isSameCalendarDay(dateRef)) return;

    const existing = uniqueGroupsMap.get(mat);
    const candidate = { ...g, _cleanMat: mat, _displayMat: rawMat };

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
    for (let i = 1; i <= 10; i++) {
      const w = g[`trabajador_${i}`];
      if (w) workers.push(uc(w));
    }

    const uniqueTasksMap = new Map<string, WorkTask>();
    safeTasks
      .filter((t) => {
        const tMat = normalizeMat(t.matricula_avion || t.matricula || t.id_avion);
        return tMat === mat && isSameCalendarDay(t.fecha);
      })
      .forEach((t) => {
        const key =
          t.codigo && t.codigo !== "null" ? String(t.codigo) : t.descripcion;
        uniqueTasksMap.set(key, {
          db_id: t.id,
          type: uc(t.tipo_tarea),
          code: uc(t.codigo),
          priority: uc(t.prioridad) || "NORMAL",
          desc: uc(t.descripcion),
          notes: uc(t.notas),
          done: Number(t.estado) === 1,
        });
      });

    return {
      id: g.id ?? Date.now(),
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
