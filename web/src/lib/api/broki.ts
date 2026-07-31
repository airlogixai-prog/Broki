import { createClient } from "@/lib/supabase/client";

type N8nRow = Record<string, unknown>;
type ToolingResponse = { catalog: N8nRow[]; movements: N8nRow[] };

export interface RegisterResult {
  ok?: boolean;
  duplicate?: boolean;
  error?: string;
  field?: string;
  message?: string;
}

export interface PlannerImportResult {
  duplicate?: boolean;
  created?: number;
  duplicates?: number;
  ignored?: number;
  errors?: string[];
  message?: string;
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

export interface Relay {
  id: string;
  timestamp: string;
  plane: string;
  worker: string;
  points: string[];
}

async function invoke<T>(
  name: string,
  init: { method: "GET" } | { method: "POST"; body: Record<string, unknown> | FormData },
): Promise<T> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke(name, init);
  if (error) throw new Error(error.message);
  return data as T;
}

export const brokiApi = {
  fetchInventory: () => invoke<N8nRow[]>("inventory-list", { method: "GET" }),
  fetchPersonnel: () => invoke<N8nRow[]>("personnel-list", { method: "GET" }),
  fetchAircraft: () => invoke<N8nRow[]>("aircraft-list", { method: "GET" }),
  fetchIncidents: () => invoke<N8nRow[]>("incidents", { method: "GET" }),
  postIncident: (body: Record<string, unknown>) =>
    invoke<N8nRow>("incidents", { method: "POST", body }),
  updateEquipment: (body: Record<string, unknown>) =>
    invoke<N8nRow>("equipment-update", { method: "POST", body }),
  fetchStock: () => invoke<N8nRow[]>("nitro-stock", { method: "GET" }),
  updateStock: (body: Record<string, unknown>) =>
    invoke<N8nRow>("nitro-stock", { method: "POST", body }),
  fetchPlannerGroups: () => invoke<N8nRow[]>("planner-groups", { method: "GET" }),
  fetchPlannerTasks: () => invoke<N8nRow[]>("planner-tasks", { method: "GET" }),
  plannerAction: (body: Record<string, unknown>) =>
    invoke<N8nRow>("planner-action", { method: "POST", body }),
  plannerActionForm: (formData: FormData) =>
    invoke<PlannerImportResult>("planner-action", { method: "POST", body: formData }),
  fetchTooling: () => invoke<ToolingResponse>("tooling-list", { method: "GET" }),
  toolingAction: (body: Record<string, unknown>) =>
    invoke<N8nRow>("tooling-action", { method: "POST", body }),
  fetchRoster: () => invoke<RosterWeek>("roster-upload", { method: "GET" }),
  rosterUpload: (formData: FormData) =>
    invoke<RosterUploadResult>("roster-upload", { method: "POST", body: formData }),
  /**
   * Public registration. Unlike the other calls this one reads the error body,
   * because the form needs the server's per-field message ("Telefono no valido")
   * rather than a generic HTTP failure.
   */
  registerPersonnel: async (body: Record<string, unknown>): Promise<RegisterResult> => {
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
  fetchRelays: () => invoke<Relay[]>("relays", { method: "GET" }),
  createRelay: (body: { plane: string; worker: string; points: string[] }) =>
    invoke<Relay>("relays", { method: "POST", body: { action: "create", ...body } }),
  deleteRelay: (id: string) =>
    invoke<{ ok: true }>("relays", { method: "POST", body: { action: "delete", id } }),
};
