import { serve } from "../_shared/handler.ts";
import { jsonResponse } from "../_shared/response.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";
import { writeAudit } from "../_shared/audit.ts";
import { extractPdfText, looksScanned, openAiJson, PdfError, readPdfUpload, sha256Hex } from "../_shared/pdf.ts";
import {
  addDays,
  aiPayloadToRows,
  mondayOf,
  parseRosterText,
  ROSTER_AI_SCHEMA,
  type RosterAiPayload,
  type RosterParseResult,
} from "../_shared/roster-parse.ts";
import { authorizeOrRespond, assertUserCanWrite } from "../_shared/request-auth.ts";

// GET  -> assignments for a week (?week=YYYY-MM-DD, defaults to the current one)
// POST -> multipart PDF; parses and stores it in broki_roster_*
//
// Used to be a pass-through to the n8n "horario" webhook whose output was never
// persisted, which is why the dashboard shipped a hardcoded roster instead.

interface AssignmentRow {
  employee_code: string | null;
  employee_name: string;
  cert_text: string | null;
  airline_team: string | null;
  day_index: number;
  shift_code: string;
}

function groupByPerson(rows: AssignmentRow[]) {
  const people = new Map<string, {
    name: string;
    id: string;
    cert: string;
    airline: string | null;
    week: string[];
  }>();

  for (const row of rows) {
    const key = row.employee_name;
    let person = people.get(key);
    if (!person) {
      person = {
        name: row.employee_name,
        id: row.employee_code ?? "",
        cert: row.cert_text ?? "",
        airline: row.airline_team,
        week: Array(7).fill(""),
      };
      people.set(key, person);
    }
    person.week[row.day_index] = row.shift_code;
    person.airline ??= row.airline_team;
  }

  return [...people.values()];
}

async function handleGet(req: Request): Promise<Response> {
  const supabase = createServiceClient();
  const url = new URL(req.url);

  if (url.searchParams.get("imports") === "1") {
    const { data, error } = await supabase
      .from("broki_roster_import_runs")
      .select("id, file_name, status, imported_count, error_count, metadata, created_at, finished_at")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[roster-upload] imports error", error);
      return jsonResponse(req, { error: "db_error" }, 500);
    }
    return jsonResponse(req, data ?? []);
  }

  const requested = url.searchParams.get("week");
  const week = requested?.match(/^\d{4}-\d{2}-\d{2}$/)
    ? requested
    : mondayOf(new Date());

  // Fall back to the most recent imported week so an out-of-date roster still
  // renders instead of showing an empty table.
  const { data: exact } = await supabase
    .from("broki_roster_periods")
    .select("id, week_start, week_end")
    .eq("week_start", week)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let period = exact;
  if (!period) {
    const { data: latest } = await supabase
      .from("broki_roster_periods")
      .select("id, week_start, week_end")
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle();
    period = latest;
  }

  if (!period) {
    return jsonResponse(req, { week: null, weekEnd: null, people: [], isFallback: false });
  }

  const { data: rows, error } = await supabase
    .from("broki_roster_assignments")
    .select("employee_code, employee_name, cert_text, airline_team, day_index, shift_code")
    .eq("period_id", period.id)
    .order("employee_name")
    .order("day_index");

  if (error) {
    console.error("[roster-upload] assignments query error", error);
    return jsonResponse(req, { error: "db_error" }, 500);
  }

  return jsonResponse(req, {
    week: period.week_start,
    weekEnd: period.week_end,
    isFallback: period.week_start !== week,
    people: groupByPerson((rows ?? []) as AssignmentRow[]),
  });
}

async function parsePdf(bytes: Uint8Array): Promise<{ parsed: RosterParseResult; source: string }> {
  const pdf = await extractPdfText(bytes);

  // The cheap parser runs on any text layer: a short sheet reads as "scanned" by
  // length alone, and skipping the parser for it would push a perfectly readable
  // roster to the AI, or drop it when no key is configured.
  const heuristic = parseRosterText(pdf.text);
  if (heuristic.rows.length > 0) return { parsed: heuristic, source: "heuristic" };

  if (looksScanned(pdf)) {
    throw new PdfError(
      "El PDF no contiene texto seleccionable. Exporta el documento con capa de texto o usa un PDF no escaneado.",
    );
  }

  const ai = await openAiJson<RosterAiPayload>({
    system:
      "You extract airline maintenance staff rosters from text. Return one entry per person " +
      "with exactly seven shifts, Monday first. Use HH:MM-HH:MM for working days and the " +
      "sheet's own absence codes (L, V, B, FS...) otherwise. Do not invent people.",
    user: pdf.text.slice(0, 60_000),
    schemaName: "roster",
    schema: ROSTER_AI_SCHEMA as unknown as Record<string, unknown>,
  });

  if (!ai) return { parsed: { rows: [], weekStart: null, weekEnd: null }, source: "none" };
  return { parsed: aiPayloadToRows(ai), source: "ai" };
}

async function handlePost(req: Request, auth?: import("./../_shared/request-auth.ts").AuthContext): Promise<Response> {
  const supabase = createServiceClient();

  const { bytes, fileName } = await readPdfUpload(req);
  const fileHash = await sha256Hex(bytes);

  // Same PDF twice is a no-op rather than a duplicated week.
  const { data: existing } = await supabase
    .from("broki_roster_import_runs")
    .select("id, status, imported_count, created_at")
    .eq("file_hash", fileHash)
    .maybeSingle();

  if (existing && existing.status === "success") {
    return jsonResponse(req, {
      duplicate: true,
      importRunId: existing.id,
      imported: existing.imported_count,
      message: "Este PDF ya se habia importado.",
    });
  }

  const { data: run, error: runErr } = await supabase
    .from("broki_roster_import_runs")
    .upsert(
      { file_hash: fileHash, file_name: fileName, status: "started" },
      { onConflict: "file_hash" },
    )
    .select("id")
    .single();

  if (runErr || !run) {
    console.error("[roster-upload] import run error", runErr);
    return jsonResponse(req, { error: "db_error" }, 500);
  }

  const fail = async (message: string, status = 422) => {
    await supabase
      .from("broki_roster_import_runs")
      .update({ status: "failed", error_count: 1, finished_at: new Date().toISOString(), metadata: { message } })
      .eq("id", run.id);
    return jsonResponse(req, { error: message, importRunId: run.id }, status);
  };

  let parsed: RosterParseResult;
  let source: string;
  try {
    ({ parsed, source } = await parsePdf(bytes));
  } catch (err) {
    console.error("[roster-upload] parse error", err);
    return await fail("No se pudo leer el PDF.");
  }

  if (parsed.rows.length === 0) {
    return await fail("No se encontro ningun turno en el PDF.");
  }

  const weekStart = parsed.weekStart ?? mondayOf(new Date());
  const weekEnd = parsed.weekEnd ?? addDays(weekStart, 6);

  const { data: period, error: periodErr } = await supabase
    .from("broki_roster_periods")
    .upsert(
      { import_run_id: run.id, week_start: weekStart, week_end: weekEnd },
      { onConflict: "import_run_id,week_start" },
    )
    .select("id")
    .single();

  if (periodErr || !period) {
    console.error("[roster-upload] period error", periodErr);
    return await fail("No se pudo guardar la semana.", 500);
  }

  // Resolve people to broki_personnel so the roster joins with the rest of the
  // schema. Matching is by employee code first, then exact name.
  const { data: personnel } = await supabase
    .from("broki_personnel")
    .select("id, nombre, cod_empleado_aena");

  const byCode = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const p of personnel ?? []) {
    if (p.cod_empleado_aena) byCode.set(String(p.cod_empleado_aena).toUpperCase(), p.id);
    if (p.nombre) byName.set(String(p.nombre).toUpperCase(), p.id);
  }

  const assignments = parsed.rows.flatMap((row) =>
    row.shifts.map((shift, dayIndex) => ({
      period_id: period.id,
      personnel_id:
        (row.employeeCode ? byCode.get(row.employeeCode.toUpperCase()) : null) ??
        byName.get(row.employeeName.toUpperCase()) ??
        null,
      employee_code: row.employeeCode,
      employee_name: row.employeeName,
      cert_text: row.cert,
      airline_team: row.airlineTeam,
      day_index: dayIndex,
      shift_code: shift.code,
      shift_start: shift.start,
      shift_end: shift.end,
      raw_payload: { source },
    }))
  );

  const { error: assignErr } = await supabase
    .from("broki_roster_assignments")
    .upsert(assignments, { onConflict: "period_id,employee_name,day_index" });

  if (assignErr) {
    console.error("[roster-upload] assignments error", assignErr);
    return await fail("No se pudieron guardar los turnos.", 500);
  }

  await supabase
    .from("broki_roster_import_runs")
    .update({
      status: "success",
      imported_count: assignments.length,
      finished_at: new Date().toISOString(),
      metadata: { source, people: parsed.rows.length, week_start: weekStart },
    })
    .eq("id", run.id);

  await writeAudit("roster.import", "broki_roster_import_runs", run.id, {
    file_name: fileName,
    source,
    people: parsed.rows.length,
    assignments: assignments.length,
    week_start: weekStart,
  }, auth);

  return jsonResponse(req, {
    importRunId: run.id,
    week: weekStart,
    weekEnd,
    people: parsed.rows.length,
    imported: assignments.length,
    source,
  });
}

serve(async (req) => {
  const auth = await authorizeOrRespond(req, "roster-upload", { mutation: req.method === "POST" });
  if (auth instanceof Response) return auth;

  if (req.method === "GET") return await handleGet(req);
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  const denied = assertUserCanWrite(req, auth);
  if (denied) return denied;

  try {
    return await handlePost(req, auth);
  } catch (err) {
    if (err instanceof PdfError) {
      return jsonResponse(req, { error: err.message }, err.status);
    }
    throw err;
  }
});
