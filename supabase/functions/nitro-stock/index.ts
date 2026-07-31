import { serve } from "../_shared/handler.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";
import { writeAudit } from "../_shared/audit.ts";

serve(async (req) => {
  if (req.method === "GET") {
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
      return jsonResponse(req, data ?? []);
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

    const action = String(body.action ?? "");
    if (!action.includes("nitro_stock") && action !== "update_nitro_stock") {
      return jsonResponse(req, { error: "invalid action for nitro-stock; use equipment-update for GSE pressures" }, 400);
    }

    const location = String(body.location ?? body.ubicacion ?? "").toLowerCase().trim();
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

      return jsonResponse(req, upserted);
    } catch (err) {
      console.error("[nitro-stock] POST unexpected error", err);
      return jsonResponse(req, { error: "internal_error" }, 500);
    }
  }

  return jsonResponse(req, { error: "method_not_allowed" }, 405);
});
