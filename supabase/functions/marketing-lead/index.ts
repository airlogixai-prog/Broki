import { serve } from "../_shared/handler.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";
import { writeAudit } from "../_shared/audit.ts";
import { LeadValidationError, validateLead } from "../_shared/lead-validate.ts";

const MAX_PER_IP_PER_HOUR = 8;
const MAX_BODY_BYTES = 16 * 1024;

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}

serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return jsonResponse(req, { error: "payload_too_large" }, 413);
  }

  let input: Record<string, unknown>;
  try {
    input = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return jsonResponse(req, { error: "invalid_json" }, 400);
  }

  let payload;
  try {
    payload = validateLead(input);
  } catch (err) {
    if (err instanceof LeadValidationError) {
      if (err.field === "website") return jsonResponse(req, { ok: true }, 202);
      return jsonResponse(req, { error: err.message, field: err.field }, 400);
    }
    throw err;
  }

  const supabase = createServiceClient();
  const ip = clientIp(req);
  const since = new Date(Date.now() - 3_600_000).toISOString();

  const { count: recent } = await supabase
    .from("broki_audit_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "marketing.lead")
    .eq("metadata->>ip", ip)
    .gte("created_at", since);

  if ((recent ?? 0) >= MAX_PER_IP_PER_HOUR) {
    return jsonResponse(
      req,
      { error: "Demasiadas solicitudes. Inténtalo de nuevo más tarde." },
      429,
    );
  }

  const { data: inserted, error } = await supabase
    .from("broki_marketing_leads")
    .insert({
      lead_type: payload.leadType,
      name: payload.name,
      email: payload.email,
      message: payload.message,
      company: payload.company,
      interest: payload.interest,
      privacy_accepted: payload.privacyAccepted,
      source_ip: ip,
      user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[marketing-lead] insert error", error);
    return jsonResponse(req, { error: "db_error" }, 500);
  }

  await writeAudit("marketing.lead", "broki_marketing_leads", inserted.id, {
    ip,
    lead_type: payload.leadType,
    email: payload.email,
  });

  return jsonResponse(req, { ok: true, id: inserted.id }, 201);
});
