import { serve } from "../_shared/handler.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";
import { authorizeOrRespond } from "../_shared/request-auth.ts";

serve(async (req) => {
  if (req.method !== "GET") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  const auth = await authorizeOrRespond(req, "planner-tasks");
  if (auth instanceof Response) return auth;

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
    return jsonResponse(req, data ?? []);
  } catch (err) {
    console.error("[planner-tasks] unexpected error", err);
    return jsonResponse(req, { error: "internal_error" }, 500);
  }
});
