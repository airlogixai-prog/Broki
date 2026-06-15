import { serve } from "../_shared/handler.ts";
import { n8nGetJson, n8nPostJson } from "../_shared/n8n.ts";
import { jsonResponse } from "../_shared/response.ts";

serve(async (req) => {
  if (req.method === "GET") {
    try {
      const data = await n8nGetJson("envio_nitro_stock", true);
      return jsonResponse(req, data);
    } catch {
      return jsonResponse(req, null);
    }
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();
      const data = await n8nPostJson("envio_nitro_stock", body);
      return jsonResponse(req, data);
    } catch {
      return jsonResponse(req, { ok: false }, 500);
    }
  }

  return jsonResponse(req, { error: "method_not_allowed" }, 405);
});
