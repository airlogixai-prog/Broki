import { serve } from "../_shared/handler.ts";
import { n8nPostJson } from "../_shared/n8n.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";
import { writeAudit } from "../_shared/audit.ts";
import { movementToLegacyRow } from "../_shared/legacy-tooling.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { error: "invalid_json" }, 400);
  }

  if (!body?.action) {
    return jsonResponse(req, { error: "missing action" }, 400);
  }

  // ponytail: remove TOOLING_USE_N8N flag after PR5 validated in staging
  if (Deno.env.get("TOOLING_USE_N8N") === "true") {
    try {
      const data = await n8nPostJson("registro_tooling", body);
      return jsonResponse(req, data);
    } catch {
      return jsonResponse(req, { error: "upstream_error" }, 502);
    }
  }

  const action = String(body.action);
  const supabase = createServiceClient();

  try {
    if (action === "checkout") {
      if (!body.bac_bact || !body.tma_out) {
        return jsonResponse(req, { error: "missing bac_bact or tma_out" }, 400);
      }

      // Resolve tool FK (optional, no hard fail)
      const { data: tool } = await supabase
        .from("broki_tooling_catalog")
        .select("id")
        .eq("bac_bact", String(body.bac_bact))
        .maybeSingle();

      const { data: inserted, error } = await supabase
        .from("broki_tooling_movements")
        .insert({
          source_system: "edge_function",
          source_table: "pro.tool_control",
          external_id: `checkout-${body.bac_bact}-${Date.now()}`,
          tool_id: tool?.id ?? null,
          bac_bact: body.bac_bact,
          descripcion: body.descripcion ?? null,
          tma_out: body.tma_out,
          date_out: body.date_out ?? new Date().toISOString(),
          avion: body.avion ?? null,
          remarks: body.remarks ?? null,
        })
        .select()
        .single();

      if (error) {
        console.error("[tooling-action] checkout error", error);
        return jsonResponse(req, { error: "db_error" }, 500);
      }

      await writeAudit("tooling.checkout", "broki_tooling_movements", inserted.id, {
        bac_bact: body.bac_bact,
        tma_out: body.tma_out,
      });

      return jsonResponse(req, movementToLegacyRow(inserted));
    }

    if (action === "checkin") {
      if (!body.tma_in) {
        return jsonResponse(req, { error: "missing tma_in" }, 400);
      }

      // Find movement by id or bac_bact where date_in is null
      let movementQuery = supabase
        .from("broki_tooling_movements")
        .select("*")
        .is("date_in", null);

      if (body.id) {
        movementQuery = movementQuery.or(
          `legacy_id.eq.${body.id},external_id.eq.${body.id}`,
        );
      } else if (body.bac_bact) {
        movementQuery = movementQuery.eq("bac_bact", String(body.bac_bact));
      } else {
        return jsonResponse(req, { error: "missing id or bac_bact for checkin" }, 400);
      }

      const { data: existing, error: findErr } = await movementQuery
        .order("date_out", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (findErr || !existing) {
        return jsonResponse(req, { error: "open_movement_not_found" }, 404);
      }

      const now = new Date().toISOString();
      const existingRemarks = existing.remarks ?? "";
      const newRemarks = body.remarks
        ? existingRemarks
          ? `${existingRemarks} | ${body.remarks}`
          : String(body.remarks)
        : existingRemarks;

      const { data: updated, error: updateErr } = await supabase
        .from("broki_tooling_movements")
        .update({
          tma_in: body.tma_in,
          date_in: body.date_in ?? now,
          remarks: newRemarks,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (updateErr) {
        console.error("[tooling-action] checkin error", updateErr);
        return jsonResponse(req, { error: "db_error" }, 500);
      }

      await writeAudit("tooling.checkin", "broki_tooling_movements", existing.id, {
        bac_bact: existing.bac_bact,
        tma_in: body.tma_in,
      });

      return jsonResponse(req, movementToLegacyRow(updated));
    }

    return jsonResponse(req, { error: `unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("[tooling-action] unexpected error", err);
    return jsonResponse(req, { error: "internal_error" }, 500);
  }
});
