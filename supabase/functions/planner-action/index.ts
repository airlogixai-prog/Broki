import { serve } from "../_shared/handler.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";
import { writeAudit } from "../_shared/audit.ts";
import { extractPdfText, looksScanned, openAiJson, PdfError, readPdfUpload, sha256Hex } from "../_shared/pdf.ts";
import {
  aiPayloadToTasks,
  parsePlannerText,
  PLANNER_AI_SCHEMA,
  type PlannerAiPayload,
  type PlannerParseResult,
} from "../_shared/planner-parse.ts";
import { authorizeOrRespond, type AuthContext } from "../_shared/request-auth.ts";

function normalizeMat(s: unknown): string {
  return String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function parsePlannerPdf(bytes: Uint8Array): Promise<{ parsed: PlannerParseResult; source: string }> {
  const pdf = await extractPdfText(bytes);

  // Always try the cheap parser first, whatever the text layer looks like. A
  // short sheet with two tasks trips the "looks scanned" heuristic even though
  // its text is perfectly readable, and skipping the parser used to send it to
  // the AI, which means losing the import outright when no key is configured.
  const heuristic = parsePlannerText(pdf.text);
  if (heuristic.tasks.length > 0) return { parsed: heuristic, source: "heuristic" };

  if (looksScanned(pdf)) {
    throw new PdfError(
      "El PDF no contiene texto seleccionable. Exporta el documento con capa de texto o usa un PDF no escaneado.",
    );
  }

  const ai = await openAiJson<PlannerAiPayload>({
    system:
      "You extract aircraft maintenance tasks from work sheets. Return one entry per task with " +
      "its code, type (MEL, CDL, PREVUELO, SERVICIO, INSPECCION, ADD), priority (NO_GO, CRITICAL, " +
      "GO_IF, NORMAL), description, aircraft registration and date as YYYY-MM-DD. Do not invent tasks.",
    user: pdf.text.slice(0, 60_000),
    schemaName: "planner_tasks",
    schema: PLANNER_AI_SCHEMA as unknown as Record<string, unknown>,
  });

  if (!ai) return { parsed: { matricula: null, fecha: null, tasks: [] }, source: "none" };
  return { parsed: aiPayloadToTasks(ai), source: "ai" };
}

/**
 * Imports a work sheet PDF. Replaces the n8n "grupotrabajo" webhook: the tasks
 * are parsed here and written to broki_planner_*, and the same file uploaded
 * twice reports duplicates instead of inserting everything again.
 */
async function handlePdfImport(req: Request, auth?: AuthContext): Promise<Response> {
  const supabase = createServiceClient();
  const { bytes, fileName, form } = await readPdfUpload(req);
  const fileHash = await sha256Hex(bytes);

  // The creator form posts the group metadata alongside the PDF, so the group is
  // built from what the user typed instead of being a bare shell.
  const formField = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };
  const formMat = normalizeMat(formField("id_avion") ?? formField("matricula") ?? "");
  const formMembers = Array.from({ length: 10 }, (_, i) => formField(`trabajador_${i + 1}`))
    .map((worker, i) => ({ position: i + 1, worker_text: worker }))
    .filter((m): m is { position: number; worker_text: string } => m.worker_text !== null);

  const { data: existing } = await supabase
    .from("broki_planner_import_runs")
    .select("id, status, created_count, duplicate_count")
    .eq("file_hash", fileHash)
    .maybeSingle();

  if (existing && existing.status === "success") {
    return jsonResponse(req, {
      duplicate: true,
      importRunId: existing.id,
      created: 0,
      duplicates: existing.created_count,
      message: "Este PDF ya se habia importado.",
    });
  }

  const { data: run, error: runErr } = await supabase
    .from("broki_planner_import_runs")
    .upsert(
      { file_hash: fileHash, file_name: fileName, status: "started" },
      { onConflict: "file_hash" },
    )
    .select("id")
    .single();

  if (runErr || !run) {
    console.error("[planner-action] import run error", runErr);
    return jsonResponse(req, { error: "db_error" }, 500);
  }

  const fail = async (message: string, status = 422) => {
    await supabase
      .from("broki_planner_import_runs")
      .update({ status: "failed", errors: [message], finished_at: new Date().toISOString() })
      .eq("id", run.id);
    return jsonResponse(req, { error: message, importRunId: run.id }, status);
  };

  let parsed: PlannerParseResult;
  let source: string;
  try {
    ({ parsed, source } = await parsePlannerPdf(bytes));
  } catch (err) {
    console.error("[planner-action] pdf parse error", err);
    return await fail("No se pudo leer el PDF.");
  }

  if (parsed.tasks.length === 0) {
    return await fail("No se encontro ninguna tarea en el PDF.");
  }

  // Group the tasks under one planner group per aircraft so the board keeps its
  // existing shape.
  const groupIdByMat = new Map<string, string>();
  const errors: string[] = [];
  let created = 0;
  let duplicates = 0;

  for (const task of parsed.tasks) {
    const mat = task.matriculaAvion ?? parsed.matricula;
    if (!mat) {
      errors.push(`${task.codigo}: sin matricula`);
      continue;
    }

    let groupId = groupIdByMat.get(mat);
    if (!groupId) {
      const isFormAircraft = formMat !== "" && mat === formMat;

      const { data: group, error: groupErr } = await supabase
        .from("broki_planner_groups")
        .insert({
          source_system: "edge_function",
          source_table: "pdf_import",
          external_id: `import-${run.id}-${mat}`,
          import_run_id: run.id,
          id_avion: isFormAircraft ? (formField("id_avion") ?? mat) : mat,
          modelo: isFormAircraft ? formField("modelo") : null,
          aerolinea: isFormAircraft ? formField("aerolinea") : null,
          vehiculo: isFormAircraft ? formField("vehiculo") : null,
          responsable: isFormAircraft ? formField("responsable") : null,
          hora_salida: isFormAircraft ? formField("hora_salida") : null,
          hora_llegada: isFormAircraft ? formField("hora_llegada") : null,
          destino: isFormAircraft ? formField("destino") : null,
          fecha_modificacion: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (groupErr || !group) {
        errors.push(`${mat}: no se pudo crear el grupo`);
        continue;
      }
      groupId = group.id;
      groupIdByMat.set(mat, groupId);

      if (isFormAircraft && formMembers.length > 0) {
        await supabase.from("broki_planner_group_members").insert(
          formMembers.map((m) => ({ group_id: groupId, ...m })),
        );
      }
    }

    const { error: taskErr } = await supabase.from("broki_planner_tasks").insert({
      source_system: "edge_function",
      source_table: "pdf_import",
      external_id: `import-${run.id}-${mat}-${task.codigo}`,
      import_run_id: run.id,
      group_id: groupId,
      tipo_tarea: task.tipoTarea,
      codigo: task.codigo,
      matricula_avion: mat,
      prioridad: task.prioridad,
      descripcion: task.descripcion,
      estado: task.estado,
      fecha: task.fecha ? `${task.fecha}T00:00:00Z` : null,
      raw_payload: { source, file_hash: fileHash },
    });

    if (taskErr) {
      // 23505 is the unique violation raised by broki_planner_tasks_dedup_idx,
      // i.e. this aircraft already has this task code for that day.
      if (taskErr.code === "23505") {
        duplicates++;
      } else {
        console.error("[planner-action] task insert error", taskErr);
        errors.push(`${task.codigo}: ${taskErr.message}`);
      }
      continue;
    }
    created++;
  }

  // Drop groups that ended up with no task at all because every task in them was
  // already imported. The aircraft the user filled in by hand is kept: that group
  // is what they asked for, tasks or not.
  for (const [mat, groupId] of groupIdByMat) {
    if (mat === formMat) continue;
    const { count } = await supabase
      .from("broki_planner_tasks")
      .select("id", { count: "exact", head: true })
      .eq("group_id", groupId);
    if (!count) await supabase.from("broki_planner_groups").delete().eq("id", groupId);
  }

  const status = errors.length > 0 ? "partial" : "success";
  await supabase
    .from("broki_planner_import_runs")
    .update({
      status,
      created_count: created,
      duplicate_count: duplicates,
      skipped_count: errors.length,
      errors,
      metadata: { source, matricula: parsed.matricula, fecha: parsed.fecha },
      finished_at: new Date().toISOString(),
    })
    .eq("id", run.id);

  await writeAudit("planner.import", "broki_planner_import_runs", run.id, {
    file_name: fileName,
    source,
    created,
    duplicates,
    errors: errors.length,
  }, auth);

  return jsonResponse(req, {
    importRunId: run.id,
    created,
    duplicates,
    ignored: errors.length,
    errors,
    source,
  });
}

serve(async (req) => {
  const auth = await authorizeOrRespond(req, "planner-action", { mutation: true });
  if (auth instanceof Response) return auth;

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    try {
      return await handlePdfImport(req, auth);
    } catch (err) {
      if (err instanceof PdfError) {
        return jsonResponse(req, { error: err.message }, err.status);
      }
      console.error("[planner-action] pdf import error", err);
      return jsonResponse(req, { error: "internal_error" }, 500);
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { error: "invalid_json" }, 400);
  }

  if (!body?.action) {
    return jsonResponse(req, { error: "missing action" }, 400);
  }

  const action = String(body.action);
  const supabase = createServiceClient();

  try {
    if (action === "create") {
      const idAvion = String(body.id_avion ?? body.matricula ?? "");
      if (!idAvion) {
        return jsonResponse(req, { error: "missing id_avion" }, 400);
      }

      const payload = {
        external_id: `group-${crypto.randomUUID()}`,
        id_avion: idAvion,
        modelo: body.modelo ?? null,
        aerolinea: body.aerolinea ?? null,
        vehiculo: body.vehiculo ?? null,
        responsable: body.responsable ?? null,
        hora_llegada: body.hora_llegada ?? null,
        hora_salida: body.hora_salida ?? null,
        destino: body.destino ?? null,
        timestamp: body.timestamp ?? new Date().toISOString(),
        ...Object.fromEntries(
          Array.from({ length: 10 }, (_, i) => [
            `trabajador_${i + 1}`,
            body[`trabajador_${i + 1}`] ?? null,
          ]),
        ),
      };

      const { data: created, error } = await supabase.rpc("broki_planner_create_group", {
        p_payload: payload,
      });

      if (error || !created) {
        console.error("[planner-action] create group error", error);
        return jsonResponse(req, { error: "db_error" }, 500);
      }

      const group = (created as { group?: Record<string, unknown> }).group ?? created;
      const members = (created as { members?: unknown[] }).members ?? [];

      await writeAudit("planner.group.create", "broki_planner_groups", String(group.id), {
        id_avion: idAvion,
      }, auth);

      return jsonResponse(req, { ...group, members });
    }

    if (action === "delete") {
      const groupId = String(body.group_id ?? "");
      if (!groupId) {
        return jsonResponse(req, { error: "missing group_id" }, 400);
      }

      const { data: deleted, error } = await supabase
        .from("broki_planner_groups")
        .delete()
        .eq("id", groupId)
        .select("id")
        .maybeSingle();

      if (error) {
        console.error("[planner-action] delete group error", error);
        return jsonResponse(req, { error: "db_error" }, 500);
      }
      if (!deleted) {
        return jsonResponse(req, { error: "group_not_found" }, 404);
      }

      await writeAudit("planner.group.delete", "broki_planner_groups", deleted.id, { group_id: groupId }, auth);
      return jsonResponse(req, deleted);
    }

    if (action === "toggle_task") {
      const taskId = String(body.task_id ?? body.task_db_id ?? "");
      const estado = Number(body.estado ?? 0);

      if (!taskId) {
        return jsonResponse(req, { error: "missing task_id" }, 400);
      }

      const { data: updated, error } = await supabase
        .from("broki_planner_tasks")
        .update({ estado })
        .eq("id", taskId)
        .select()
        .maybeSingle();

      if (error) {
        console.error("[planner-action] toggle_task error", error);
        return jsonResponse(req, { error: "db_error" }, 500);
      }
      if (!updated) {
        return jsonResponse(req, { error: "task_not_found" }, 404);
      }

      await writeAudit("planner.task.toggle", "broki_planner_tasks", updated.id, { estado }, auth);
      return jsonResponse(req, updated);
    }

    if (action === "delete_task") {
      const taskId = String(body.task_id ?? body.task_db_id ?? "");

      if (!taskId) {
        return jsonResponse(req, { error: "missing task_id" }, 400);
      }

      const { data: deleted, error } = await supabase
        .from("broki_planner_tasks")
        .delete()
        .eq("id", taskId)
        .select("id")
        .maybeSingle();

      if (error) {
        console.error("[planner-action] delete_task error", error);
        return jsonResponse(req, { error: "db_error" }, 500);
      }
      if (!deleted) {
        return jsonResponse(req, { error: "task_not_found" }, 404);
      }

      await writeAudit("planner.task.delete", "broki_planner_tasks", deleted.id, { task_id: taskId }, auth);
      return jsonResponse(req, deleted);
    }

    return jsonResponse(req, { error: `unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("[planner-action] unexpected error", err);
    return jsonResponse(req, { error: "internal_error" }, 500);
  }
});
