import { serve } from "../_shared/handler.ts";
import { n8nPostForm, n8nPostJson } from "../_shared/n8n.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";
import { writeAudit } from "../_shared/audit.ts";
import { groupToLegacyRow, taskToLegacyRow, normalizeMat } from "../_shared/legacy-planner.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  const contentType = req.headers.get("content-type") ?? "";

  // --- Multipart / PDF branch: always proxy to n8n ---
  // ponytail: PDF parsing via IA stays in n8n until native parser exists;
  // set PLANNER_PDF_USE_N8N=false only when EF handles PDF
  if (contentType.includes("multipart/form-data")) {
    const pdfUseN8n = Deno.env.get("PLANNER_PDF_USE_N8N") !== "false";
    if (pdfUseN8n) {
      try {
        const formData = await req.formData();
        const data = await n8nPostForm("grupotrabajo", formData);
        return jsonResponse(req, data);
      } catch {
        return jsonResponse(req, { error: "upstream_error" }, 502);
      }
    }
    return jsonResponse(req, { error: "pdf_not_supported_yet" }, 501);
  }

  // --- JSON branch ---
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { error: "invalid_json" }, 400);
  }

  if (!body?.action) {
    return jsonResponse(req, { error: "missing action" }, 400);
  }

  // ponytail: remove PLANNER_USE_N8N flag after PR6 validated in staging
  if (Deno.env.get("PLANNER_USE_N8N") === "true") {
    try {
      const data = await n8nPostJson("grupotrabajo", body);
      return jsonResponse(req, data);
    } catch {
      return jsonResponse(req, { error: "upstream_error" }, 502);
    }
  }

  const action = String(body.action);
  const supabase = createServiceClient();

  try {
    // ----- create -----
    if (action === "create") {
      const idAvion = String(body.id_avion ?? body.matricula ?? "");
      if (!idAvion) {
        return jsonResponse(req, { error: "missing id_avion" }, 400);
      }

      const { data: inserted, error } = await supabase
        .from("broki_planner_groups")
        .insert({
          source_system: "edge_function",
          source_table: "pro.grupo_trabajo",
          external_id: `group-${normalizeMat(idAvion)}-${Date.now()}`,
          id_avion: idAvion,
          modelo: body.modelo ?? null,
          aerolinea: body.aerolinea ?? null,
          vehiculo: body.vehiculo ?? null,
          responsable: body.responsable ?? null,
          hora_llegada: body.hora_llegada ?? null,
          hora_salida: body.hora_salida ?? null,
          destino: body.destino ?? null,
          fecha_modificacion: body.timestamp ?? new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error("[planner-action] create group error", error);
        return jsonResponse(req, { error: "db_error" }, 500);
      }

      // Insert members trabajador_1..10
      const memberInserts = [];
      for (let i = 1; i <= 10; i++) {
        const w = String(body[`trabajador_${i}`] ?? "").trim();
        if (w) {
          memberInserts.push({ group_id: inserted.id, position: i, worker_text: w });
        }
      }
      if (memberInserts.length > 0) {
        await supabase.from("broki_planner_group_members").insert(memberInserts);
      }

      const members = memberInserts.map((m) => ({
        group_id: inserted.id,
        position: m.position,
        worker_text: m.worker_text,
      }));

      await writeAudit("planner.group.create", "broki_planner_groups", inserted.id, {
        id_avion: idAvion,
      });

      return jsonResponse(req, groupToLegacyRow(inserted, members));
    }

    // ----- delete group -----
    if (action === "delete") {
      const mat = normalizeMat(String(body.matricula ?? body.id_avion ?? ""));
      if (!mat) {
        return jsonResponse(req, { error: "missing matricula" }, 400);
      }

      const { data: toDelete } = await supabase
        .from("broki_planner_groups")
        .select("id")
        .ilike("id_avion", `%${mat}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (toDelete) {
        await supabase.from("broki_planner_groups").delete().eq("id", toDelete.id);
        await writeAudit("planner.group.delete", "broki_planner_groups", toDelete.id, { mat });
      }

      return jsonResponse(req, { ok: true });
    }

    // ----- toggle_task -----
    if (action === "toggle_task") {
      const taskDbId = body.task_db_id;
      const codigo = String(body.codigo ?? "");
      const mat = normalizeMat(String(body.matricula_avion ?? ""));
      const estado = Number(body.estado ?? 0);

      if (!taskDbId && !codigo) {
        return jsonResponse(req, { error: "missing task_db_id or codigo" }, 400);
      }

      let taskQuery = supabase.from("broki_planner_tasks").select("id");
      if (taskDbId) {
        taskQuery = taskQuery.or(`legacy_id.eq.${taskDbId},id.eq.${taskDbId}`);
      } else {
        taskQuery = taskQuery.eq("codigo", codigo);
        if (mat) taskQuery = taskQuery.ilike("matricula_avion", `%${mat}%`);
      }

      const { data: task } = await taskQuery.limit(1).maybeSingle();

      if (!task) {
        return jsonResponse(req, { error: "task_not_found" }, 404);
      }

      const { data: updated, error } = await supabase
        .from("broki_planner_tasks")
        .update({ estado })
        .eq("id", task.id)
        .select()
        .single();

      if (error) {
        console.error("[planner-action] toggle_task error", error);
        return jsonResponse(req, { error: "db_error" }, 500);
      }

      return jsonResponse(req, taskToLegacyRow(updated));
    }

    // ----- delete_task -----
    if (action === "delete_task") {
      const codigo = String(body.codigo ?? "");
      const mat = normalizeMat(String(body.matricula_avion ?? ""));

      if (!codigo) {
        return jsonResponse(req, { error: "missing codigo" }, 400);
      }

      let q = supabase.from("broki_planner_tasks").select("id").eq("codigo", codigo);
      if (mat) q = q.ilike("matricula_avion", `%${mat}%`);
      const { data: task } = await q.limit(1).maybeSingle();

      if (task) {
        await supabase.from("broki_planner_tasks").delete().eq("id", task.id);
        await writeAudit("planner.task.delete", "broki_planner_tasks", task.id, { codigo, mat });
      }

      return jsonResponse(req, { ok: true });
    }

    return jsonResponse(req, { error: `unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("[planner-action] unexpected error", err);
    return jsonResponse(req, { error: "internal_error" }, 500);
  }
});
