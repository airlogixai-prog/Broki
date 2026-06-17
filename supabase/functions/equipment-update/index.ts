import { serve } from "../_shared/handler.ts";
import { n8nPostJson } from "../_shared/n8n.ts";
import { jsonResponse } from "../_shared/response.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  try {
    const body = await req.json();
    if (!body?.item_id) {
      return jsonResponse(req, { error: "missing item_id" }, 400);
    }
    const data = await n8nPostJson("Inventario", body);
    return jsonResponse(req, data);
  } catch {
    return jsonResponse(req, { error: "upstream_error" }, 502);
  }
});
