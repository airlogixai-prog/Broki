import { createClient } from "@/lib/supabase/client";
import type {
  AircraftRow,
  AssetRow,
  IncidentRow,
  NitroStockRow,
  PersonnelRow,
  PlannerGroupRow,
  PlannerTaskRow,
  ToolingListResponse,
  ToolingMovementRow,
} from "@/lib/api/canonical";

export type {
  AircraftRow,
  AssetRow,
  IncidentRow,
  NitroStockRow,
  PersonnelRow,
  PlannerGroupRow,
  PlannerTaskRow,
  ToolingCatalogRow,
  ToolingListResponse,
  ToolingMovementRow,
} from "@/lib/api/canonical";

export interface RegisterResult {
  ok?: boolean;
  duplicate?: boolean;
  error?: string;
  field?: string;
  message?: string;
}

export interface MarketingLeadResult {
  ok?: boolean;
  id?: string;
  error?: string;
  field?: string;
}

export interface PlannerImportResult {
  duplicate?: boolean;
  created?: number;
  duplicates?: number;
  ignored?: number;
  errors?: string[];
  message?: string;
}

export interface PlannerPreviewTask {
  codigo: string | null;
  tipo_tarea: string | null;
  prioridad: string | null;
  descripcion: string | null;
  matricula_avion: string | null;
  fecha: string | null;
  estado: number | null;
}

/** planner-action multipart with dry_run=1: parsed tasks, nothing written. */
export interface PlannerPreviewResult {
  dry_run: true;
  source: string;
  matricula: string | null;
  fecha: string | null;
  already_imported: boolean;
  tasks: PlannerPreviewTask[];
}

export interface RosterPerson {
  name: string;
  id: string;
  cert: string;
  airline: "iberojet" | "w2f" | null;
  /** Seven shift codes, Monday first. Empty string means no data for that day. */
  week: string[];
}

export interface RosterWeek {
  week: string | null;
  weekEnd: string | null;
  /** True when the requested week had no import and an older one is shown. */
  isFallback: boolean;
  people: RosterPerson[];
}

export interface RosterUploadResult {
  duplicate?: boolean;
  imported?: number;
  people?: number;
  week?: string;
  message?: string;
}

export interface ImportRun {
  id: string;
  file_name?: string | null;
  status?: string | null;
  created_count?: number | null;
  duplicate_count?: number | null;
  skipped_count?: number | null;
  imported_count?: number | null;
  error_count?: number | null;
  errors?: unknown;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  finished_at?: string | null;
}

export interface Relay {
  id: string;
  timestamp: string;
  plane: string;
  worker: string;
  points: string[];
}

/** Action payloads remain open objects (server validates). */
type ActionBody = Record<string, unknown>;

/**
 * Error with the server's JSON body attached, so the UI can react to codes
 * (`stale_update`, `open_checkout_exists`, `forbidden`…) instead of showing
 * "Edge Function returned a non-2xx status code".
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
    readonly payload: Record<string, unknown> | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const CODE_MESSAGES: Record<string, string> = {
  stale_update: "Otro usuario ha modificado este equipo mientras lo editabas. Recarga para ver los cambios.",
  open_checkout_exists: "Esta herramienta ya está sacada. Devuélvela antes de volver a sacarla.",
  open_movement_not_found: "No hay ninguna sacada abierta para esta herramienta.",
  forbidden: "No tienes permisos para esta operación.",
  unauthorized: "Sesión no válida. Vuelve a iniciar sesión.",
  asset_not_found: "El equipo no existe en la base de datos.",
  incident_not_found: "La incidencia no existe o ya fue cerrada.",
  group_not_found: "El grupo ya no existe.",
  task_not_found: "La tarea ya no existe.",
  task_duplicate: "Esa tarea ya existe para este avión y fecha.",
  db_error: "Error de base de datos. Inténtalo de nuevo.",
  internal_error: "Error interno del servidor.",
  method_not_allowed: "Operación no permitida.",
  rate_limited: "Demasiadas peticiones. Espera un momento.",
};

async function toApiError(error: { message: string; context?: unknown }): Promise<ApiError> {
  const ctx = error.context;
  let status = 0;
  let payload: Record<string, unknown> | null = null;
  if (ctx && typeof ctx === "object" && "status" in ctx) {
    const res = ctx as Response;
    status = res.status;
    try {
      payload = (await res.clone().json()) as Record<string, unknown>;
    } catch {
      payload = null;
    }
  }
  const code = payload && typeof payload.error === "string" ? payload.error : null;
  const message =
    (code && CODE_MESSAGES[code]) ||
    (payload && typeof payload.message === "string" ? payload.message : null) ||
    (code && /\s/.test(code) ? code : null) ||
    (status === 0 ? "Sin conexión con el servidor." : error.message);
  return new ApiError(message, status, code, payload);
}

async function invoke<T>(
  name: string,
  init: { method: "GET" } | { method: "POST"; body: ActionBody | FormData },
): Promise<T> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke(name, init);
  if (error) throw await toApiError(error);
  return data as T;
}

export function isApiError(e: unknown, code?: string): e is ApiError {
  return e instanceof ApiError && (code === undefined || e.code === code);
}

export const brokiApi = {
  fetchInventory: () => invoke<AssetRow[]>("inventory-list", { method: "GET" }),
  fetchPersonnel: () => invoke<PersonnelRow[]>("personnel-list", { method: "GET" }),
  fetchAircraft: () => invoke<AircraftRow[]>("aircraft-list", { method: "GET" }),
  aircraftAction: (body: ActionBody) =>
    invoke<AircraftRow>("aircraft-action", { method: "POST", body }),
  fetchPlannerImports: () =>
    invoke<ImportRun[]>("planner-groups?imports=1", { method: "GET" }),
  fetchRosterImports: () =>
    invoke<ImportRun[]>("roster-upload?imports=1", { method: "GET" }),
  fetchIncidents: () => invoke<IncidentRow[]>("incidents", { method: "GET" }),
  postIncident: (body: ActionBody) =>
    invoke<IncidentRow>("incidents", { method: "POST", body }),
  updateEquipment: (body: ActionBody) =>
    invoke<AssetRow>("equipment-update", { method: "POST", body }),
  fetchStock: () => invoke<NitroStockRow[]>("nitro-stock", { method: "GET" }),
  updateStock: (body: ActionBody) =>
    invoke<NitroStockRow>("nitro-stock", { method: "POST", body }),
  fetchPlannerGroups: () => invoke<PlannerGroupRow[]>("planner-groups", { method: "GET" }),
  fetchPlannerTasks: () => invoke<PlannerTaskRow[]>("planner-tasks", { method: "GET" }),
  plannerAction: (body: ActionBody) =>
    invoke<PlannerGroupRow | PlannerTaskRow>("planner-action", { method: "POST", body }),
  plannerActionForm: (formData: FormData) =>
    invoke<PlannerImportResult>("planner-action", { method: "POST", body: formData }),
  plannerPreviewForm: (formData: FormData) =>
    invoke<PlannerPreviewResult>("planner-action", { method: "POST", body: formData }),
  fetchTooling: () => invoke<ToolingListResponse>("tooling-list", { method: "GET" }),
  toolingAction: (body: ActionBody) =>
    invoke<ToolingMovementRow>("tooling-action", { method: "POST", body }),
  fetchRoster: (week?: string) =>
    invoke<RosterWeek>(
      week ? `roster-upload?week=${encodeURIComponent(week)}` : "roster-upload",
      { method: "GET" },
    ),
  rosterUpload: (formData: FormData) =>
    invoke<RosterUploadResult>("roster-upload", { method: "POST", body: formData }),
  /**
   * Public registration. Unlike the other calls this one reads the error body,
   * because the form needs the server's per-field message ("Telefono no valido")
   * rather than a generic HTTP failure.
   */
  registerPersonnel: async (body: ActionBody): Promise<RegisterResult> => {
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke<RegisterResult>(
      "personnel-register",
      { method: "POST", body },
    );

    if (!error) return data ?? { ok: true };

    const response = (error as { context?: Response }).context;
    if (response && typeof response.json === "function") {
      try {
        const payload = (await response.json()) as RegisterResult;
        if (payload?.error) return payload;
      } catch {
        // Fall through to the generic message below.
      }
    }
    throw new Error(error.message);
  },
  submitMarketingLead: async (
    body: ActionBody,
  ): Promise<MarketingLeadResult> => {
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke<MarketingLeadResult>(
      "marketing-lead",
      { method: "POST", body },
    );

    if (!error) return data ?? { ok: true };

    const response = (error as { context?: Response }).context;
    if (response && typeof response.json === "function") {
      try {
        const payload = (await response.json()) as MarketingLeadResult;
        if (payload?.error) {
          throw new Error(
            payload.field ? `${payload.error} (field: ${payload.field})` : payload.error,
          );
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes("field:")) throw e;
      }
    }
    throw new Error(error.message);
  },
  fetchRelays: () => invoke<Relay[]>("relays", { method: "GET" }),
  createRelay: (body: { plane: string; worker: string; points: string[] }) =>
    invoke<Relay>("relays", { method: "POST", body: { action: "create", ...body } }),
  deleteRelay: (id: string) =>
    invoke<{ ok: true }>("relays", { method: "POST", body: { action: "delete", id } }),
};
