// Shape converters: broki_planner_* <-> legacy n8n planner rows.
// Consumer: planner/page.tsx via mergePlannerData() in web/src/lib/mappers/planner.ts.
// mergePlannerData reads id_avion/matricula, trabajador_1..10, hora_salida, hora_llegada,
// fecha_modificacion and task fields: tipo_tarea, codigo, matricula_avion, prioridad,
// descripcion, notas, estado, fecha.

export type PlannerGroupRow = Record<string, unknown>;
export type PlannerMemberRow = Record<string, unknown>;
export type PlannerTaskRow = Record<string, unknown>;

export function groupToLegacyRow(
  group: PlannerGroupRow,
  members: PlannerMemberRow[],
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: group.legacy_id ?? group.id,
    id_avion: group.id_avion,
    matricula: group.id_avion,
    modelo: group.modelo ?? "",
    aerolinea: group.aerolinea ?? "",
    vehiculo: group.vehiculo ?? "",
    responsable: group.responsable ?? "",
    hora_llegada: group.hora_llegada ?? null,
    hora_salida: group.hora_salida ?? null,
    destino: group.destino ?? "",
    fecha_modificacion: group.fecha_modificacion ?? group.updated_at,
  };

  for (let i = 1; i <= 10; i++) {
    const member = members.find((m) => Number(m.position) === i);
    row[`trabajador_${i}`] = member?.worker_text ?? "";
  }

  return row;
}

export function taskToLegacyRow(task: PlannerTaskRow): Record<string, unknown> {
  return {
    id: task.legacy_id ?? task.id,
    tipo_tarea: task.tipo_tarea ?? "",
    codigo: task.codigo ?? "",
    matricula_avion: task.matricula_avion ?? "",
    prioridad: task.prioridad ?? "NORMAL",
    descripcion: task.descripcion ?? "",
    notas: task.notas ?? "",
    estado: task.estado ?? 0,
    fecha: task.fecha ?? null,
    fecha_modificacion: task.fecha_modificacion ?? task.updated_at,
  };
}

export function normalizeMat(s: unknown): string {
  return String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
