import { serve } from "../_shared/handler.ts";
import { n8nGetJson, n8nPostJson } from "../_shared/n8n.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";
import { writeAudit } from "../_shared/audit.ts";
import { incidentToLegacyRow } from "../_shared/legacy-incidents.ts";

serve(async (req) => {
  // ponytail: remove INCIDENTS_USE_N8N flag after PR2 validated in staging
  const useN8n = Deno.env.get("INCIDENTS_USE_N8N") === "true";

  if (req.method === "GET") {
    if (useN8n) {
      try {
        const data = await n8nGetJson("envio_incidencias");
        return jsonResponse(req, data);
      } catch {
        return jsonResponse(req, { error: "upstream_error" }, 502);
      }
    }

    try {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("broki_incidents")
        .select("*")
        .order("fecha_apertura", { ascending: false, nullsFirst: false });

      if (error) {
        console.error("[incidents] GET error", error);
        return jsonResponse(req, { error: "db_error" }, 500);
      }
      return jsonResponse(req, (data ?? []).map(incidentToLegacyRow));
    } catch (err) {
      console.error("[incidents] GET unexpected error", err);
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

    if (!body?.action || !body?.item_id) {
      return jsonResponse(req, { error: "missing action or item_id" }, 400);
    }

    if (useN8n) {
      try {
        const data = await n8nPostJson("incidencias", body);
        return jsonResponse(req, data);
      } catch {
        return jsonResponse(req, { error: "upstream_error" }, 502);
      }
    }

    const action = String(body.action);
    const itemId = String(body.item_id);
    const incidentId = String(body.incident_id ?? "");
    const now = new Date().toISOString();

    try {
      const supabase = createServiceClient();

      // Resolve asset FK (optional — no hard fail if asset not found)
      const { data: asset } = await supabase
        .from("broki_assets")
        .select("id")
        .eq("identifier", itemId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const assetId = asset?.id ?? null;

      if (action === "open_incident") {
        const initialMessage = {
          user: String(body.worker ?? "Operario"),
          text: String(body.defect ?? ""),
          time: String(body.timestamp ?? now),
        };

        const { data: inserted, error } = await supabase
          .from("broki_incidents")
          .insert({
            source_system: "edge_function",
            source_table: "broki_incidents",
            external_id: incidentId || `${itemId}-${Date.now()}`,
            incident_code: incidentId,
            id_objeto: itemId,
            asset_id: assetId,
            descripcion: String(body.defect ?? ""),
            estado: 1,
            status_text: "abierta",
            trabajador_text: String(body.worker ?? ""),
            fecha_apertura: String(body.timestamp ?? now),
            raw_payload: { messages: [initialMessage] },
          })
          .select()
          .single();

        if (error) {
          console.error("[incidents] open_incident error", error);
          return jsonResponse(req, { error: "db_error" }, 500);
        }

        await writeAudit("incident.open", "broki_incidents", inserted.id, {
          item_id: itemId,
          incident_id: incidentId,
        });

        return jsonResponse(req, incidentToLegacyRow(inserted));
      }

      if (action === "update_incident" || action === "close_incident") {
        const { data: existing, error: findErr } = await supabase
          .from("broki_incidents")
          .select("*")
          .eq("incident_code", incidentId)
          .maybeSingle();

        if (findErr || !existing) {
          return jsonResponse(req, { error: "incident_not_found" }, 404);
        }

        const rawPayload = (existing.raw_payload ?? {}) as Record<string, unknown>;
        const messages = Array.isArray(rawPayload.messages) ? [...rawPayload.messages] : [];

        if (body.message || body.defect) {
          messages.push({
            user: String(body.worker ?? existing.trabajador_text ?? "Operario"),
            text: String(body.message ?? body.defect ?? ""),
            time: String(body.timestamp ?? now),
          });
        }

        const patch: Record<string, unknown> = {
          raw_payload: { ...rawPayload, messages },
        };

        if (action === "close_incident") {
          patch.estado = 0;
          patch.status_text = "cerrada";
          patch.fecha_cierre = String(body.timestamp ?? now);
        }

        const { data: updated, error: updateErr } = await supabase
          .from("broki_incidents")
          .update(patch)
          .eq("id", existing.id)
          .select()
          .single();

        if (updateErr) {
          console.error("[incidents] update error", updateErr);
          return jsonResponse(req, { error: "db_error" }, 500);
        }

        await writeAudit(`incident.${action}`, "broki_incidents", existing.id, {
          item_id: itemId,
          incident_id: incidentId,
        });

        return jsonResponse(req, incidentToLegacyRow(updated));
      }

      return jsonResponse(req, { error: "unknown_action" }, 400);
    } catch (err) {
      console.error("[incidents] POST unexpected error", err);
      return jsonResponse(req, { error: "internal_error" }, 500);
    }
  }

  return jsonResponse(req, { error: "method_not_allowed" }, 405);
});
