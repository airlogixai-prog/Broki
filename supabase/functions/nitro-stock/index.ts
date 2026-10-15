import { serve } from "../_shared/handler.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";
import { writeAudit } from "../_shared/audit.ts";
import { authorizeOrRespond, assertUserCanWrite, readMutationBody, respondMutation } from "../_shared/request-auth.ts";

serve(async (req) => {
  const auth = await authorizeOrRespond(req, "nitro-stock", { mutation: req.method === "POST" });
  if (auth instanceof Response) return auth;

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
    const denied = assertUserCanWrite(req, auth);
    if (denied) return denied;

    const parsed = await readMutationBody(req, auth, "nitro-stock");
    if (!parsed.ok) return parsed.response;
    const { body, bodyText } = parsed;

    const action = String(body.action ?? "");
    if (!action.includes("nitro_stock") && action !== "update_nitro_stock") {
      return jsonResponse(req, { error: "invalid action for nitro-stock; use equipment-update for GSE pressures" }, 400);
    }

    const location = String(body.location ?? body.ubicacion ?? "").toLowerCase().trim();
    if (!location) {
      return jsonResponse(req, { error: "missing location" }, 400);
    }

    if (location.length > 40 || !/^[a-z0-9 ,._-]+$/.test(location)) {
      return jsonResponse(req, { error: "invalid location" }, 400);
    }
    const llenas = Number(body.llenas ?? body.botellas_llenas ?? 0);
    const vacias = Number(body.vacias ?? body.botellas_vacias ?? 0);
    for (const [field, n] of [["llenas", llenas], ["vacias", vacias]] as const) {
      if (!Number.isInteger(n) || n < 0 || n > 9999) {
        return jsonResponse(req, { error: `${field} debe ser un entero entre 0 y 9999`, field }, 400);
      }
    }

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
      }, auth);

      return respondMutation(req, auth, "nitro-stock", bodyText, 200, upserted);
    } catch (err) {
      console.error("[nitro-stock] POST unexpected error", err);
      return jsonResponse(req, { error: "internal_error" }, 500);
    }
  }

  return jsonResponse(req, { error: "method_not_allowed" }, 405);
});
