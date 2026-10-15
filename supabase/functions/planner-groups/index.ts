import { serve } from "../_shared/handler.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";
import { authorizeOrRespond } from "../_shared/request-auth.ts";

serve(async (req) => {
  if (req.method !== "GET") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  const auth = await authorizeOrRespond(req, "planner-groups");
  if (auth instanceof Response) return auth;

  try {
    const supabase = createServiceClient();
    const url = new URL(req.url);

    if (url.searchParams.get("imports") === "1") {
      const { data, error } = await supabase
        .from("broki_planner_import_runs")
        .select("id, file_name, status, created_count, duplicate_count, skipped_count, errors, metadata, created_at, finished_at")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("[planner-groups] imports error", error);
        return jsonResponse(req, { error: "db_error" }, 500);
      }
      return jsonResponse(req, data ?? []);
    }

    const [groupsRes, membersRes] = await Promise.all([
      supabase.from("broki_planner_groups").select("*").order("hora_salida", {
        ascending: true,
        nullsFirst: false,
      }),
      supabase
        .from("broki_planner_group_members")
        .select("group_id, position, worker_text")
        .order("position"),
    ]);

    if (groupsRes.error) {
      console.error("[planner-groups] groups error", groupsRes.error);
      return jsonResponse(req, { error: "db_error" }, 500);
    }
    if (membersRes.error) {
      console.error("[planner-groups] members error", membersRes.error);
      return jsonResponse(req, { error: "db_error" }, 500);
    }

    const membersByGroup = new Map<string, Record<string, unknown>[]>();
    for (const m of membersRes.data ?? []) {
      const list = membersByGroup.get(m.group_id) ?? [];
      list.push(m);
      membersByGroup.set(m.group_id, list);
    }

    const rows = (groupsRes.data ?? []).map((g) => ({
      ...g,
      members: membersByGroup.get(g.id) ?? [],
    }));

    return jsonResponse(req, rows);
  } catch (err) {
    console.error("[planner-groups] unexpected error", err);
    return jsonResponse(req, { error: "internal_error" }, 500);
  }
});
