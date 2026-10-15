import { serve } from "../_shared/handler.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";
import { authorizeOrRespond } from "../_shared/request-auth.ts";

serve(async (req) => {
  if (req.method !== "GET") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  const auth = await authorizeOrRespond(req, "personnel-list");
  if (auth instanceof Response) return auth;

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("broki_personnel")
      .select("*")
      .or("estado.is.null,estado.neq.0")
      .order("nombre");

    if (error) {
      console.error("[personnel-list] query error", error);
      return jsonResponse(req, { error: "db_error" }, 500);
    }
    // The dashboard needs names, codes and qualifications; contact data (PII)
    // stays server-side regardless of the caller's dashboard role.
    const PII = ["telefono", "correo", "email", "phone", "dni", "nif", "raw_payload"];
    const rows = (data ?? []).map((row) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
        if (!PII.includes(k)) out[k] = v;
      }
      return out;
    });
    return jsonResponse(req, rows);
  } catch (err) {
    console.error("[personnel-list] unexpected error", err);
    return jsonResponse(req, { error: "internal_error" }, 500);
  }
});
