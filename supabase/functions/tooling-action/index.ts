import { serve } from "../_shared/handler.ts";
import { n8nPostJson } from "../_shared/n8n.ts";
import { jsonResponse } from "../_shared/response.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  try {
    const body = await req.json();
    const data = await n8nPostJson("registro_tooling", body);
    return jsonResponse(req, data);
  } catch {
    return jsonResponse(req, { ok: false }, 500);
  }
});
