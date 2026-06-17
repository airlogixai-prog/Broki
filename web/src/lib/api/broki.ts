import { createClient } from "@/lib/supabase/client";
import type { WeatherData } from "@/lib/alerts/buildCriticalAlerts";

export class BrokiApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrokiApiError";
  }
}

type N8nRow = Record<string, unknown>;
type ToolingResponse = { catalog: N8nRow[]; movements: N8nRow[] };

async function invokeGet<T>(name: string): Promise<T> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke(name, {
    method: "GET",
  });
  if (error) throw new BrokiApiError(error.message);
  return data as T;
}

async function invokePost<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke(name, {
    method: "POST",
    body,
  });
  if (error) throw new BrokiApiError(error.message);
  return data as T;
}

async function invokeFormData<T>(name: string, formData: FormData): Promise<T> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke(name, {
    method: "POST",
    body: formData,
  });
  if (error) throw new BrokiApiError(error.message);
  return data as T;
}

export const brokiApi = {
  fetchInventory: () => invokeGet<N8nRow[]>("inventory-list"),
  fetchPersonnel: () => invokeGet<N8nRow[]>("personnel-list"),
  fetchAircraft: () => invokeGet<N8nRow[]>("aircraft-list"),
  fetchIncidents: () => invokeGet<N8nRow[]>("incidents"),
  postIncident: (body: Record<string, unknown>) =>
    invokePost<N8nRow>("incidents", body),
  updateEquipment: (body: Record<string, unknown>) =>
    invokePost<N8nRow>("equipment-update", body),
  fetchStock: () => invokeGet<N8nRow[]>("nitro-stock"),
  updateStock: (body: Record<string, unknown>) =>
    invokePost<N8nRow>("nitro-stock", body),
  fetchWeather: () => invokeGet<WeatherData>("weather"),
  fetchPlannerGroups: () => invokeGet<N8nRow[]>("planner-groups"),
  fetchPlannerTasks: () => invokeGet<N8nRow[]>("planner-tasks"),
  plannerAction: (body: Record<string, unknown>) =>
    invokePost<N8nRow>("planner-action", body),
  plannerActionForm: (formData: FormData) =>
    invokeFormData<N8nRow>("planner-action", formData),
  fetchTooling: () => invokeGet<ToolingResponse>("tooling-list"),
  toolingAction: (body: Record<string, unknown>) =>
    invokePost<N8nRow>("tooling-action", body),
  rosterUpload: (formData: FormData) =>
    invokeFormData<N8nRow>("roster-upload", formData),
};
