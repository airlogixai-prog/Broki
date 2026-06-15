import { createClient } from "@/lib/supabase/client";

export class BrokiApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrokiApiError";
  }
}

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

export const brokiApi = {
  fetchInventory: () => invokeGet<unknown>("inventory-list"),
  fetchPersonnel: () => invokeGet<unknown>("personnel-list"),
  fetchAircraft: () => invokeGet<unknown>("aircraft-list"),
  fetchIncidents: () => invokeGet<unknown>("incidents"),
  postIncident: (body: Record<string, unknown>) =>
    invokePost<unknown>("incidents", body),
  updateEquipment: (body: Record<string, unknown>) =>
    invokePost<unknown>("equipment-update", body),
  fetchStock: () => invokeGet<unknown>("nitro-stock"),
  updateStock: (body: Record<string, unknown>) =>
    invokePost<unknown>("nitro-stock", body),
  fetchPlannerGroups: () => invokeGet<unknown>("planner-groups"),
  fetchPlannerTasks: () => invokeGet<unknown>("planner-tasks"),
  plannerAction: (body: Record<string, unknown>) =>
    invokePost<unknown>("planner-action", body),
  fetchTooling: () =>
    invokeGet<{ catalog: unknown; movements: unknown }>("tooling-list"),
  toolingAction: (body: Record<string, unknown>) =>
    invokePost<unknown>("tooling-action", body),
};
