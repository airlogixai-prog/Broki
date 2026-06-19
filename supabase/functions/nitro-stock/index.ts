import { serve } from "../_shared/handler.ts";
import { n8nGetJson, n8nPostJson } from "../_shared/n8n.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";
import { writeAudit } from "../_shared/audit.ts";
import { nitroStockToLegacyRow, normalizeUbicacion } from "../_shared/legacy-nitro-stock.ts";

serve(async (req) => {
  // ponytail: remove NITRO_USE_N8N flag after PR4 validated in staging
  const useN8n = Deno.env.get("NITRO_USE_N8N") === "true";

  if (req.method === "GET") {
    if (useN8n) {
      try {
        const data = await n8nGetJson("envio_nitro_stock", true);
        return jsonResponse(req, data);
      } catch {
        return jsonResponse(req, { error: "upstream_error" }, 502);
      }
    }

    try {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("broki_nitro_stock")
        .select("*")
        .order("ubicacion");

      if (error) {
        console.error("[nitro-stock] GET error", error);
        return jsonResponse(req, { error: "db_error" }, 500);
      }
      return jsonResponse(req, (data ?? []).map(nitroStockToLegacyRow));
    } catch (err) {
      console.error("[nitro-stock] GET unexpected error", err);
      return jsonResponse(req, { error: "internal_error" }, 500);
    }
  }

  if (req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(req, { error: "invalid_json" }, 400);
    }

    if (useN8n) {
      try {
        const data = await n8nPostJson("Inventario", body);
        return jsonResponse(req, data);
      } catch {
        return jsonResponse(req, { error: "upstream_error" }, 502);
      }
    }

    // Only handle stock updates here; GSE bottle pressures go via equipment-update
    const action = String(body.action ?? "");
    if (!action.includes("nitro_stock") && action !== "update_nitro_stock") {
      return jsonResponse(req, { error: "invalid action for nitro-stock; use equipment-update for GSE pressures" }, 400);
    }

    const location = normalizeUbicacion(String(body.location ?? body.ubicacion ?? ""));
    if (!location) {
      return jsonResponse(req, { error: "missing location" }, 400);
    }

    const llenas = Number(body.llenas ?? body.botellas_llenas ?? 0);
    const vacias = Number(body.vacias ?? body.botellas_vacias ?? 0);

    try {
      const supabase = createServiceClient();

      const { data: upserted, error } = await supabase
        .from("broki_nitro_stock")
        .upsert(
          {
            source_system: "edge_function",
            source_table: "nitro_stock",
            external_id: location,
            ubicacion: location,
            botellas_llenas: llenas,
            botellas_vacias: vacias,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "ubicacion" },
        )
        .select()
        .single();

      if (error) {
        console.error("[nitro-stock] upsert error", error);
        return jsonResponse(req, { error: "db_error" }, 500);
      }

      await writeAudit("nitro_stock.update", "broki_nitro_stock", upserted.id, {
        location,
        llenas,
        vacias,
      });

      return jsonResponse(req, nitroStockToLegacyRow(upserted));
    } catch (err) {
      console.error("[nitro-stock] POST unexpected error", err);
      return jsonResponse(req, { error: "internal_error" }, 500);
    }
  }

  return jsonResponse(req, { error: "method_not_allowed" }, 405);
});
