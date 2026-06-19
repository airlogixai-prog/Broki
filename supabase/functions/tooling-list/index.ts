import { serve } from "../_shared/handler.ts";
import { n8nGetJson } from "../_shared/n8n.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";
import { catalogToLegacyRow, movementToLegacyRow } from "../_shared/legacy-tooling.ts";

serve(async (req) => {
  if (req.method !== "GET") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  // ponytail: remove TOOLING_USE_N8N flag after PR5 validated in staging
  if (Deno.env.get("TOOLING_USE_N8N") === "true") {
    try {
      const [catalog, movements] = await Promise.all([
        n8nGetJson("tooling"),
        n8nGetJson("registro_tooling"),
      ]);
      return jsonResponse(req, { catalog, movements });
    } catch {
      return jsonResponse(req, { error: "upstream_error" }, 502);
    }
  }

  try {
    const supabase = createServiceClient();
    const [catRes, movRes] = await Promise.all([
      supabase.from("broki_tooling_catalog").select("*").order("bac_bact"),
      supabase
        .from("broki_tooling_movements")
        .select("*")
        .order("date_out", { ascending: false, nullsFirst: false }),
    ]);

    if (catRes.error) {
      console.error("[tooling-list] catalog error", catRes.error);
      return jsonResponse(req, { error: "db_error" }, 500);
    }
    if (movRes.error) {
      console.error("[tooling-list] movements error", movRes.error);
      return jsonResponse(req, { error: "db_error" }, 500);
    }

    return jsonResponse(req, {
      catalog: (catRes.data ?? []).map(catalogToLegacyRow),
      movements: (movRes.data ?? []).map(movementToLegacyRow),
    });
  } catch (err) {
    console.error("[tooling-list] unexpected error", err);
    return jsonResponse(req, { error: "internal_error" }, 500);
  }
});
