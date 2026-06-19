import { createServiceClient } from "./supabase-admin.ts";

export async function writeAudit(
  eventType: string,
  entity: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from("broki_audit_events").insert({
      event_type: eventType,
      entity,
      entity_id: entityId,
      source_system: "edge_function",
      metadata,
    });
  } catch (err) {
    // ponytail: audit failures must not break the main operation
    console.error("[audit] write failed", err);
  }
}
