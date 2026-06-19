import { serve } from "../_shared/handler.ts";
import { n8nGetJson } from "../_shared/n8n.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";
import { taskToLegacyRow } from "../_shared/legacy-planner.ts";

serve(async (req) => {
  if (req.method !== "GET") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  // ponytail: remove PLANNER_USE_N8N flag after PR6 validated in staging
  if (Deno.env.get("PLANNER_USE_N8N") === "true") {
    try {
      const data = await n8nGetJson("envio_task", true);
      return jsonResponse(req, data);
    } catch {
      return jsonResponse(req, { error: "upstream_error" }, 502);
    }
  }

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("broki_planner_tasks")
      .select("*")
      .order("fecha", { ascending: false, nullsFirst: false });

    if (error) {
      console.error("[planner-tasks] query error", error);
      return jsonResponse(req, { error: "db_error" }, 500);
    }
    return jsonResponse(req, (data ?? []).map(taskToLegacyRow));
  } catch (err) {
    console.error("[planner-tasks] unexpected error", err);
    return jsonResponse(req, { error: "internal_error" }, 500);
  }
});
