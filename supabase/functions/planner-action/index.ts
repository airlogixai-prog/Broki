import { serve } from "../_shared/handler.ts";
import { n8nPostForm, n8nPostJson } from "../_shared/n8n.ts";
import { jsonResponse } from "../_shared/response.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const matricula = formData.get("matricula") ?? formData.get("id_avion");
      if (!matricula && !formData.get("file")) {
        return jsonResponse(req, { error: "missing matricula or file" }, 400);
      }
      const data = await n8nPostForm("grupotrabajo", formData);
      return jsonResponse(req, data);
    }

    const body = await req.json();
    if (!body?.action) {
      return jsonResponse(req, { error: "missing action" }, 400);
    }
    const data = await n8nPostJson("grupotrabajo", body);
    return jsonResponse(req, data);
  } catch {
    return jsonResponse(req, { error: "upstream_error" }, 502);
  }
});
