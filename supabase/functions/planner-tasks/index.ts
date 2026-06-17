import { serve } from "../_shared/handler.ts";
import { n8nGetJson } from "../_shared/n8n.ts";
import { jsonResponse } from "../_shared/response.ts";

serve(async (req) => {
  if (req.method !== "GET") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  try {
    const data = await n8nGetJson("envio_task", true);
    return jsonResponse(req, data);
  } catch {
    return jsonResponse(req, { error: "upstream_error" }, 502);
  }
});
