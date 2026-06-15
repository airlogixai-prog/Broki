import { serve } from "../_shared/handler.ts";
import { n8nGetJson } from "../_shared/n8n.ts";
import { jsonResponse } from "../_shared/response.ts";

serve(async (req) => {
  if (req.method !== "GET") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  try {
    const [catalog, movements] = await Promise.all([
      n8nGetJson("tooling"),
      n8nGetJson("registro_tooling"),
    ]);
    return jsonResponse(req, { catalog, movements });
  } catch {
    return jsonResponse(req, { catalog: [], movements: [] });
  }
});
