import { createServiceClient } from "./supabase-admin.ts";
import type { AuthContext } from "./request-auth.ts";

export async function writeAudit(
  eventType: string,
  entity: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
  auth?: AuthContext,
): Promise<void> {
  try {
    const supabase = createServiceClient();

    const actorUserId = auth?.kind === "user" ? auth.userId : null;
    const actorType = auth?.kind ?? null;
    const actorServiceId = auth?.kind === "service" ? auth.serviceId : null;
    const requestId = auth?.kind === "service" ? auth.requestId : null;
    const idempotencyKey = auth?.kind === "service" ? auth.idempotencyKey : null;

    await supabase.from("broki_audit_events").insert({
      event_type: eventType,
      entity,
      entity_id: entityId,
      source_system: "edge_function",
      actor_user_id: actorUserId,
      actor_type: actorType,
      actor_service_id: actorServiceId,
      metadata: {
        ...metadata,
        ...(requestId ? { request_id: requestId } : {}),
        ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
      },
    });
  } catch (err) {
    // ponytail: audit failures must not break the main operation
    console.error("[audit] write failed", err);
  }
}
