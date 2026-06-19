import { serve } from "../_shared/handler.ts";
import { n8nGetJson } from "../_shared/n8n.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";
import { personnelToLegacyRow } from "../_shared/legacy-personnel.ts";

serve(async (req) => {
  if (req.method !== "GET") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  // ponytail: remove PERSONNEL_USE_N8N flag after PR3 validated in staging
  if (Deno.env.get("PERSONNEL_USE_N8N") === "true") {
    try {
      const data = await n8nGetJson("pro_personal");
      return jsonResponse(req, data);
    } catch {
      return jsonResponse(req, { error: "upstream_error" }, 502);
    }
  }

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
    return jsonResponse(req, (data ?? []).map(personnelToLegacyRow));
  } catch (err) {
    console.error("[personnel-list] unexpected error", err);
    return jsonResponse(req, { error: "internal_error" }, 500);
  }
});
