import { serve } from "../_shared/handler.ts";
import { n8nGetJson, n8nPostJson } from "../_shared/n8n.ts";
import { jsonResponse } from "../_shared/response.ts";

serve(async (req) => {
  if (req.method === "GET") {
    try {
      const data = await n8nGetJson("envio_incidencias");
      return jsonResponse(req, data);
    } catch {
      return jsonResponse(req, { error: "upstream_error" }, 502);
    }
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (!body?.action || !body?.item_id) {
        return jsonResponse(req, { error: "missing action or item_id" }, 400);
      }
      const data = await n8nPostJson("incidencias", body);
      return jsonResponse(req, data);
    } catch {
      return jsonResponse(req, { error: "upstream_error" }, 502);
    }
  }

  return jsonResponse(req, { error: "method_not_allowed" }, 405);
});
