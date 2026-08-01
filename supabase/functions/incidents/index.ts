import { serve } from "../_shared/handler.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";
import { writeAudit } from "../_shared/audit.ts";
import { authorizeOrRespond } from "../_shared/request-auth.ts";

type IncidentRow = {
  id: string;
  incident_code: string | null;
  id_objeto: string | null;
  descripcion: string | null;
  estado: number | null;
  status_text: string | null;
  trabajador_text: string | null;
  fecha_apertura: string | null;
  fecha_cierre: string | null;
  created_at: string | null;
  raw_payload: Record<string, unknown> | null;
  broki_incident_messages?: Array<{
    author_text: string | null;
    message_text: string;
    created_at: string;
  }>;
};

function mapMessages(row: IncidentRow) {
  const tableMsgs = row.broki_incident_messages ?? [];
  if (tableMsgs.length > 0) {
    return tableMsgs
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((m) => ({
        user: m.author_text || "Operario",
        text: m.message_text,
        time: m.created_at,
      }));
  }

  const legacy = row.raw_payload?.messages;
  if (Array.isArray(legacy)) {
    return legacy.map((m: Record<string, unknown>) => ({
      user: String(m.user ?? row.trabajador_text ?? "Operario"),
      text: String(m.text ?? row.descripcion ?? "Incidencia"),
      time: String(m.time ?? row.fecha_apertura ?? row.created_at ?? new Date().toISOString()),
    }));
  }

  return [
    {
      user: row.trabajador_text || "Reporte",
      text: row.descripcion || "Incidencia",
      time: row.fecha_apertura || row.created_at || new Date().toISOString(),
    },
  ];
}

function toClientIncident(row: IncidentRow) {
  return {
    ...row,
    messages: mapMessages(row),
  };
}

serve(async (req) => {
  const auth = await authorizeOrRespond(req, "incidents", { mutation: req.method === "POST" });
  if (auth instanceof Response) return auth;

  if (req.method === "GET") {
    try {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("broki_incidents")
        .select("*, broki_incident_messages(author_text, message_text, created_at)")
        .order("fecha_apertura", { ascending: false, nullsFirst: false });

      if (error) {
        console.error("[incidents] GET error", error);
        return jsonResponse(req, { error: "db_error" }, 500);
      }

      const rows = (data ?? []) as IncidentRow[];
      return jsonResponse(req, rows.map(toClientIncident));
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

    const action = String(body.action);
    const itemId = String(body.item_id);
    const incidentId = String(body.incident_id ?? "");
    const now = new Date().toISOString();
    const worker = String(body.worker ?? "Operario").trim() || "Operario";
    const messageText = String(body.message ?? body.defect ?? "").trim();

    try {
      const supabase = createServiceClient();

      const { data: asset } = await supabase
        .from("broki_assets")
        .select("id")
        .eq("identifier", itemId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const assetId = asset?.id ?? null;

      if (action === "open_incident") {
        if (!messageText) {
          return jsonResponse(req, { error: "missing defect text" }, 400);
        }

        const code = incidentId || `${itemId}-${Date.now()}`;
        const openedAt = String(body.timestamp ?? now);

        const { data: inserted, error } = await supabase
          .from("broki_incidents")
          .insert({
            source_system: "edge_function",
            source_table: "broki_incidents",
            external_id: code,
            incident_code: code,
            id_objeto: itemId,
            asset_id: assetId,
            descripcion: messageText,
            estado: 1,
            status_text: "abierta",
            trabajador_text: worker,
            fecha_apertura: openedAt,
            raw_payload: {},
          })
          .select("*, broki_incident_messages(author_text, message_text, created_at)")
          .single();

        if (error || !inserted) {
          console.error("[incidents] open_incident error", error);
          return jsonResponse(req, { error: "db_error" }, 500);
        }

        const { error: msgErr } = await supabase.from("broki_incident_messages").insert({
          incident_id: inserted.id,
          author_text: worker,
          message_text: messageText,
          created_at: openedAt,
        });

        if (msgErr) {
          await supabase.from("broki_incidents").delete().eq("id", inserted.id);
          console.error("[incidents] open_incident message error", msgErr);
          return jsonResponse(req, { error: "db_error" }, 500);
        }

        await writeAudit("incident.open", "broki_incidents", inserted.id, {
          item_id: itemId,
          incident_id: code,
        }, auth);

        const { data: withMsgs } = await supabase
          .from("broki_incidents")
          .select("*, broki_incident_messages(author_text, message_text, created_at)")
          .eq("id", inserted.id)
          .single();

        return jsonResponse(req, toClientIncident((withMsgs ?? inserted) as IncidentRow));
      }

      if (action === "update_incident" || action === "close_incident") {
        if (!incidentId) {
          return jsonResponse(req, { error: "missing incident_id" }, 400);
        }

        const { data: existing, error: findErr } = await supabase
          .from("broki_incidents")
          .select("*")
          .eq("incident_code", incidentId)
          .maybeSingle();

        if (findErr || !existing) {
          return jsonResponse(req, { error: "incident_not_found" }, 404);
        }

        if (messageText) {
          const { error: msgErr } = await supabase.from("broki_incident_messages").insert({
            incident_id: existing.id,
            author_text: worker,
            message_text: messageText,
            created_at: String(body.timestamp ?? now),
          });
          if (msgErr) {
            console.error("[incidents] message insert error", msgErr);
            return jsonResponse(req, { error: "db_error" }, 500);
          }
        }

        const patch: Record<string, unknown> = {};
        if (action === "close_incident") {
          patch.estado = 0;
          patch.status_text = "cerrada";
          patch.fecha_cierre = String(body.timestamp ?? now);
        }

        let updatedRow = existing;
        if (Object.keys(patch).length > 0) {
          const { data: updated, error: updateErr } = await supabase
            .from("broki_incidents")
            .update(patch)
            .eq("id", existing.id)
            .select("*")
            .single();

          if (updateErr || !updated) {
            console.error("[incidents] update error", updateErr);
            return jsonResponse(req, { error: "db_error" }, 500);
          }
          updatedRow = updated;
        }

        await writeAudit(`incident.${action}`, "broki_incidents", existing.id, {
          item_id: itemId,
          incident_id: incidentId,
        }, auth);

        const { data: withMsgs } = await supabase
          .from("broki_incidents")
          .select("*, broki_incident_messages(author_text, message_text, created_at)")
          .eq("id", existing.id)
          .single();

        return jsonResponse(req, toClientIncident((withMsgs ?? updatedRow) as IncidentRow));
      }

      return jsonResponse(req, { error: "unknown_action" }, 400);
    } catch (err) {
      console.error("[incidents] POST unexpected error", err);
      return jsonResponse(req, { error: "internal_error" }, 500);
    }
  }

  return jsonResponse(req, { error: "method_not_allowed" }, 405);
});
