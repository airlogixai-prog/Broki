import { serve } from "../_shared/handler.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";

serve(async (req) => {
  if (req.method !== "GET") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  try {
    const supabase = createServiceClient();

    const { data: rows, error: qErr } = await supabase
      .from("broki_assets")
      .select("*")
      .or(
        "asset_kind.in.(van,gse,inventory,nitro)," +
          "source_table.in.(inventario,furgonetas,gse,pro.inventario,pro.furgonetas,pro.gse)",
      )
      .order("identifier")
      .order("updated_at", { ascending: false });

    if (qErr) {
      console.error("[inventory-list] query error", qErr);
      return jsonResponse(req, { error: "db_error" }, 500);
    }

    const seen = new Set<string>();
    const deduped = (rows ?? []).filter((r) => {
      const key = String(r.identifier ?? "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return jsonResponse(req, deduped);
  } catch (err) {
    console.error("[inventory-list] unexpected error", err);
    return jsonResponse(req, { error: "internal_error" }, 500);
  }
});
