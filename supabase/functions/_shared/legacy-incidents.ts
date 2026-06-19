// Shape converters: broki_incidents <-> legacy n8n incident row.
// Consumer: useEquipment.ts — reads item_id, incident_id, status, defect, messages.

export type IncidentRow = Record<string, unknown>;

function str(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

export function incidentToLegacyRow(row: IncidentRow): Record<string, unknown> {
  const rawPayload = (row.raw_payload ?? {}) as Record<string, unknown>;
  const messages = rawPayload.messages ?? [];

  const statusText = str(row.status_text);
  const estado = Number(row.estado ?? 0);
  const isOpen =
    estado === 1 ||
    statusText.toLowerCase().includes("abierta") ||
    statusText === "open";

  return {
    incident_id: row.incident_code ?? row.external_id,
    id: row.incident_code ?? row.external_id,
    item_id: row.id_objeto,
    id_objeto: row.id_objeto,
    status: isOpen ? "abierta" : "cerrada",
    estado: isOpen ? 1 : 0,
    worker: row.trabajador_text,
    defect: row.descripcion,
    descripcion: row.descripcion,
    created_at: row.fecha_apertura ?? row.created_at,
    closed_at: row.fecha_cierre ?? null,
    messages,
  };
}
