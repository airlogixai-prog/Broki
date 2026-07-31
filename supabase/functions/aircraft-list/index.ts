import { serve } from "../_shared/handler.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";

serve(async (req) => {
  if (req.method !== "GET") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("broki_aircraft")
      .select("*")
      .order("matricula");

    if (error) {
      console.error("[aircraft-list] query error", error);
      return jsonResponse(req, { error: "db_error" }, 500);
    }
    return jsonResponse(req, data ?? []);
  } catch (err) {
    console.error("[aircraft-list] unexpected error", err);
    return jsonResponse(req, { error: "internal_error" }, 500);
  }
});
