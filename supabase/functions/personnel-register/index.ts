import { serve } from "../_shared/handler.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";
import { writeAudit } from "../_shared/audit.ts";
import {
  toPersonnelRow,
  validateRegistration,
  ValidationError,
  type RegisterInput,
} from "../_shared/register-validate.ts";

// Public endpoint (verify_jwt = false) backing /registrobroki.
// Replaces the n8n webhook the legacy form posted to. Rows land as
// review_status = 'pending' so an anonymous submission never creates an active
// operator record.

const MAX_PER_IP_PER_HOUR = 5;
const MAX_BODY_BYTES = 32 * 1024;

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

  let input: RegisterInput;
  try {
    input = JSON.parse(raw) as RegisterInput;
  } catch {
    return jsonResponse(req, { error: "invalid_json" }, 400);
  }

  let payload;
  try {
    payload = validateRegistration(input);
  } catch (err) {
    if (err instanceof ValidationError) {
      // The honeypot must not tell a bot why it failed.
      if (err.field === "website") return jsonResponse(req, { ok: true }, 202);
      return jsonResponse(req, { error: err.message, field: err.field }, 400);
    }
    throw err;
  }

  const supabase = createServiceClient();
  const ip = clientIp(req);

  // ponytail: rate limit by counting audit rows for this IP in the last hour.
  // Good enough for a form nobody floods on purpose; if it ever needs to survive
  // a real botnet, move the counter to a dedicated table with an index on (ip, ts)
  // or put the endpoint behind a WAF rule.
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count: recent } = await supabase
    .from("broki_audit_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "personnel.register")
    .eq("metadata->>ip", ip)
    .gte("created_at", since);

  if ((recent ?? 0) >= MAX_PER_IP_PER_HOUR) {
    return jsonResponse(
      req,
      { error: "Demasiadas solicitudes. Intentalo de nuevo mas tarde." },
      429,
    );
  }

  // Duplicate detection across the three identifiers the legacy form treated as
  // unique. Reported as a conflict rather than creating a second record.
  const orFilters = [`telefono.eq.${payload.telefono}`];
  if (payload.codigoEmpleado) orFilters.push(`cod_empleado_aena.eq.${payload.codigoEmpleado}`);
  if (payload.email) orFilters.push(`correo.ilike.${payload.email}`);

  const { data: existing } = await supabase
    .from("broki_personnel")
    .select("id, review_status")
    .or(orFilters.join(","))
    .limit(1)
    .maybeSingle();

  if (existing) {
    await writeAudit("personnel.register", "broki_personnel", existing.id, {
      ip,
      outcome: "duplicate",
    });
    return jsonResponse(
      req,
      {
        duplicate: true,
        error: "Ya existe un registro con ese telefono, correo o codigo de empleado.",
      },
      409,
    );
  }

  const { data: inserted, error } = await supabase
    .from("broki_personnel")
    .insert(toPersonnelRow(payload))
    .select("id")
    .single();

  if (error) {
    console.error("[personnel-register] insert error", error);
    // A unique violation here means a concurrent submission won the race.
    if (error.code === "23505") {
      return jsonResponse(
        req,
        { duplicate: true, error: "Ya existe un registro con esos datos." },
        409,
      );
    }
    return jsonResponse(req, { error: "No se pudo guardar el registro." }, 500);
  }

  await writeAudit("personnel.register", "broki_personnel", inserted.id, {
    ip,
    outcome: "created",
    departamento: payload.departamento,
  });

  return jsonResponse(
    req,
    {
      ok: true,
      id: inserted.id,
      status: "pending",
      message: "Registro recibido. Queda pendiente de revision.",
    },
    201,
  );
});
