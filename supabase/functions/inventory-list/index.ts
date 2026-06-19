import { serve } from "../_shared/handler.ts";
import { n8nGetJson } from "../_shared/n8n.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";
import { assetToLegacyRow } from "../_shared/legacy-assets.ts";

serve(async (req) => {
  if (req.method !== "GET") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  // ponytail: remove INVENTORY_USE_N8N flag after PR1 validated in staging
  if (Deno.env.get("INVENTORY_USE_N8N") === "true") {
    try {
      const data = await n8nGetJson("pro_inventario");
      return jsonResponse(req, data);
    } catch {
      return jsonResponse(req, { error: "upstream_error" }, 502);
    }
  }

  try {
    const supabase = createServiceClient();

    // Dedupe by identifier, keep the most recently updated row.
    // Source tables inventario/furgonetas/gse may all import the same identifier.
    const { data, error } = await supabase.rpc("broki_inventory_list_legacy");

    if (error) {
      // Fallback: direct query if RPC does not exist yet
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

      // Dedupe in memory: first occurrence per identifier wins (already sorted updated_at DESC)
      const seen = new Set<string>();
      const deduped = (rows ?? []).filter((r) => {
        const key = String(r.identifier ?? "");
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return jsonResponse(req, deduped.map(assetToLegacyRow));
    }

    return jsonResponse(req, (data ?? []).map(assetToLegacyRow));
  } catch (err) {
    console.error("[inventory-list] unexpected error", err);
    return jsonResponse(req, { error: "internal_error" }, 500);
  }
});
