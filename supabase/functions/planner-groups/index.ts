import { serve } from "../_shared/handler.ts";
import { n8nGetJson } from "../_shared/n8n.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";
import { groupToLegacyRow } from "../_shared/legacy-planner.ts";

serve(async (req) => {
  if (req.method !== "GET") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  // ponytail: remove PLANNER_USE_N8N flag after PR6 validated in staging
  if (Deno.env.get("PLANNER_USE_N8N") === "true") {
    try {
      const data = await n8nGetJson("envio_grupo_trabajo", true);
      return jsonResponse(req, data);
    } catch {
      return jsonResponse(req, { error: "upstream_error" }, 502);
    }
  }

  try {
    const supabase = createServiceClient();

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

    // Do NOT filter "today" in backend — mergePlannerData() in frontend handles it
    const rows = (groupsRes.data ?? []).map((g) =>
      groupToLegacyRow(g, membersByGroup.get(g.id) ?? [])
    );

    return jsonResponse(req, rows);
  } catch (err) {
    console.error("[planner-groups] unexpected error", err);
    return jsonResponse(req, { error: "internal_error" }, 500);
  }
});
