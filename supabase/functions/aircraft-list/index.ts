import { serve } from "../_shared/handler.ts";
import { n8nGetJson } from "../_shared/n8n.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";
import { aircraftToLegacyRow } from "../_shared/legacy-aircraft.ts";

serve(async (req) => {
  if (req.method !== "GET") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  // ponytail: remove AIRCRAFT_USE_N8N flag after PR3 validated in staging
  if (Deno.env.get("AIRCRAFT_USE_N8N") === "true") {
    try {
      const data = await n8nGetJson("envio_avion");
      return jsonResponse(req, data);
    } catch {
      return jsonResponse(req, { error: "upstream_error" }, 502);
    }
  }

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("broki_aircraft")
      .select("*")
      .order("matricula");

    if (error) {
      console.error("[aircraft-list] query error", error);
      return jsonResponse(req, { error: "db_error" }, 500);
    }
    return jsonResponse(req, (data ?? []).map(aircraftToLegacyRow));
  } catch (err) {
    console.error("[aircraft-list] unexpected error", err);
    return jsonResponse(req, { error: "internal_error" }, 500);
  }
});
