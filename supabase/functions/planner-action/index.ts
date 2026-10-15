import { serve } from "../_shared/handler.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";
import { writeAudit } from "../_shared/audit.ts";
import { extractPdfText, looksScanned, openAiJson, PdfError, readPdfUpload, sha256Hex } from "../_shared/pdf.ts";
import {
  aiPayloadToTasks,
  parsePlannerTable,
  parsePlannerText,
  PLANNER_AI_SCHEMA,
  type PlannerAiPayload,
  type PlannerParseResult,
} from "../_shared/planner-parse.ts";
import { authorizeOrRespond, assertUserCanWrite, readMutationBody, respondMutation, type AuthContext } from "../_shared/request-auth.ts";
import { assertUuid } from "../_shared/uuid.ts";

function requireUuid(req: Request, value: unknown, field: string): string | Response {
  try {
    return assertUuid(value, field);
  } catch {
    return jsonResponse(req, { error: `invalid ${field}` }, 400);
  }
}

function normalizeMat(s: unknown): string {
  return String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function parsePlannerPdf(bytes: Uint8Array): Promise<{ parsed: PlannerParseResult; source: string }> {
  const pdf = await extractPdfText(bytes);

  // 1. Try the tabular parser first: handles exported daily_workload PDFs with
  //    fixed-width columns including a "Realizado" column (→ estado 1).
  const table = parsePlannerTable(pdf.text);
  if (table.tasks.length > 0) return { parsed: table, source: "table" };

  // 2. Fall back to the legacy line-by-line heuristic for older free-text sheets.
  //    A short sheet with two tasks trips the "looks scanned" heuristic even
  //    though its text is perfectly readable, so we try it regardless.
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

  // Preview: parse only, write nothing. The UI shows the extracted tasks and
  // asks for confirmation before the real import.
  if (formField("dry_run") === "1") {
    let parsed: PlannerParseResult;
    let source: string;
    try {
      ({ parsed, source } = await parsePlannerPdf(bytes));
    } catch (err) {
      console.error("[planner-action] pdf preview error", err);
      return jsonResponse(req, { error: "No se pudo leer el PDF." }, 422);
    }
    return jsonResponse(req, {
      dry_run: true,
      source,
      matricula: parsed.matricula,
      fecha: parsed.fecha,
      already_imported: !!existing && existing.status === "success",
      tasks: parsed.tasks.map((t) => ({
        codigo: t.codigo,
        tipo_tarea: t.tipoTarea,
        prioridad: t.prioridad,
        descripcion: t.descripcion,
        matricula_avion: t.matriculaAvion ?? parsed.matricula,
        fecha: t.fecha,
        estado: t.estado,
      })),
    });
  }

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
      groupId = String(group.id);
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
        errors.push(`${task.codigo}: no se pudo guardar la tarea`);
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
  const denied = assertUserCanWrite(req, auth);
  if (denied) return denied;

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
  let bodyText = "";
  if (auth.kind === "service") {
    const parsed = await readMutationBody(req, auth, "planner-action");
    if (!parsed.ok) return parsed.response;
    body = parsed.body;
    bodyText = parsed.bodyText;
  } else {
    try {
      bodyText = await req.text();
      body = bodyText ? JSON.parse(bodyText) as Record<string, unknown> : {};
    } catch {
      return jsonResponse(req, { error: "invalid_json" }, 400);
    }
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
        timestamp: new Date().toISOString(),
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

      return respondMutation(req, auth, "planner-action", bodyText, 200, { ...group, members });
    }

    if (action === "delete") {
      const groupId = requireUuid(req, body.group_id, "group_id");
      if (groupId instanceof Response) return groupId;

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
      return respondMutation(req, auth, "planner-action", bodyText, 200, deleted);
    }

    if (action === "toggle_task") {
      const taskId = requireUuid(req, body.task_id ?? body.task_db_id, "task_id");
      if (taskId instanceof Response) return taskId;
      const estado = Number(body.estado ?? 0);
      if (estado !== 0 && estado !== 1) {
        return jsonResponse(req, { error: "estado must be 0 or 1" }, 400);
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
      return respondMutation(req, auth, "planner-action", bodyText, 200, updated);
    }

    if (action === "delete_task") {
      const taskId = requireUuid(req, body.task_id ?? body.task_db_id, "task_id");
      if (taskId instanceof Response) return taskId;

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
      return respondMutation(req, auth, "planner-action", bodyText, 200, deleted);
    }

    if (action === "update_task") {
      const taskId = requireUuid(req, body.task_id ?? body.task_db_id, "task_id");
      if (taskId instanceof Response) return taskId;

      const patch: Record<string, unknown> = {
        fecha_modificacion: new Date().toISOString(),
      };
      if (body.descripcion != null) patch.descripcion = body.descripcion;
      if (body.prioridad != null) patch.prioridad = body.prioridad;
      if (body.notas != null) patch.notas = body.notas;
      if (body.tipo_tarea != null) patch.tipo_tarea = body.tipo_tarea;
      if (body.estado != null) patch.estado = Number(body.estado);

      const { data: updated, error } = await supabase
        .from("broki_planner_tasks")
        .update(patch)
        .eq("id", taskId)
        .select()
        .maybeSingle();

      if (error) {
        console.error("[planner-action] update_task error", error);
        return jsonResponse(req, { error: "db_error" }, 500);
      }
      if (!updated) {
        return jsonResponse(req, { error: "task_not_found" }, 404);
      }

      await writeAudit("planner.task.update", "broki_planner_tasks", updated.id, patch, auth);
      return respondMutation(req, auth, "planner-action", bodyText, 200, updated);
    }

    if (action === "create_task") {
      const groupId = requireUuid(req, body.group_id, "group_id");
      if (groupId instanceof Response) return groupId;

      const codigo = String(body.codigo ?? "").trim();
      if (!codigo) {
        return jsonResponse(req, { error: "missing codigo" }, 400);
      }

      const { data: inserted, error } = await supabase
        .from("broki_planner_tasks")
        .insert({
          source_system: "edge_function",
          source_table: "manual",
          external_id: `task-${crypto.randomUUID()}`,
          group_id: groupId,
          codigo,
          tipo_tarea: body.tipo_tarea ?? "SERVICIO",
          prioridad: body.prioridad ?? "NORMAL",
          descripcion: body.descripcion ?? codigo,
          notas: body.notas ?? null,
          matricula_avion: body.matricula_avion ?? null,
          estado: 0,
          fecha_modificacion: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          return jsonResponse(req, { error: "task_duplicate" }, 409);
        }
        console.error("[planner-action] create_task error", error);
        return jsonResponse(req, { error: "db_error" }, 500);
      }

      await writeAudit("planner.task.create", "broki_planner_tasks", inserted.id, { group_id: groupId }, auth);
      return respondMutation(req, auth, "planner-action", bodyText, 201, inserted);
    }

    if (action === "update_group") {
      const groupId = requireUuid(req, body.group_id, "group_id");
      if (groupId instanceof Response) return groupId;

      const patch: Record<string, unknown> = {
        fecha_modificacion: new Date().toISOString(),
      };
      for (const key of [
        "id_avion", "modelo", "aerolinea", "vehiculo", "responsable",
        "hora_salida", "hora_llegada", "destino",
      ] as const) {
        if (body[key] != null) patch[key] = body[key];
      }

      const { data: updated, error } = await supabase
        .from("broki_planner_groups")
        .update(patch)
        .eq("id", groupId)
        .select()
        .maybeSingle();

      if (error) {
        console.error("[planner-action] update_group error", error);
        return jsonResponse(req, { error: "db_error" }, 500);
      }
      if (!updated) {
        return jsonResponse(req, { error: "group_not_found" }, 404);
      }

      const workers: string[] = [];
      for (let i = 1; i <= 10; i++) {
        const w = body[`trabajador_${i}`];
        if (typeof w === "string" && w.trim()) workers.push(w.trim());
      }
      if (body.workers && Array.isArray(body.workers)) {
        workers.length = 0;
        for (const w of body.workers) {
          if (typeof w === "string" && w.trim()) workers.push(w.trim());
        }
      }
      if (workers.length > 0 || body.replace_workers === true) {
        await supabase.from("broki_planner_group_members").delete().eq("group_id", groupId);
        if (workers.length > 0) {
          await supabase.from("broki_planner_group_members").insert(
            workers.slice(0, 10).map((worker_text, i) => ({
              group_id: groupId,
              position: i + 1,
              worker_text,
            })),
          );
        }
      }

      await writeAudit("planner.group.update", "broki_planner_groups", groupId, patch, auth);
      return respondMutation(req, auth, "planner-action", bodyText, 200, updated);
    }

    return jsonResponse(req, { error: `unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("[planner-action] unexpected error", err);
    return jsonResponse(req, { error: "internal_error" }, 500);
  }
});
