// Planner work-sheet PDF parsing. Replaces the n8n "grupotrabajo" multipart
// webhook: the tasks now land in broki_planner_tasks directly.

export interface PlannerTask {
  tipoTarea: string | null;
  codigo: string;
  prioridad: string | null;
  descripcion: string | null;
  matriculaAvion: string | null;
  fecha: string | null;
  estado: number;
}

export interface PlannerParseResult {
  matricula: string | null;
  fecha: string | null;
  tasks: PlannerTask[];
}

/** Spanish/European registration marks: EC-NFP, G-ABCD, D-AIMA, N123AB. */
const REGISTRATION = /\b([A-Z]{1,2}-[A-Z]{3,5}|N\d{1,5}[A-Z]{0,2})\b/;

// MEL-2201, PRE-0455, SRV/0912.
// ponytail: the separator is required. Allowing a bare space also matches the
// tail of a header line ("EC-NFP 2025-09-01" -> "NFP 2025"), which turns the
// sheet header into a phantom task. If a real sheet ever writes "ADD 1234",
// widen this to [-/ ] and skip candidates that overlap the line's registration.
const TASK_CODE = /\b([A-Z]{2,5}[-/]\d{3,6})\b/;

const TASK_TYPES: [label: string, pattern: RegExp][] = [
  ["MEL", /\bMEL\b/],
  ["CDL", /\bCDL\b/],
  ["NEF", /\bNEF\b/],
  ["PREVUELO", /\bPRE ?VUELO\b|\bPREFLIGHT\b|\bPRE\b/],
  ["SERVICIO", /\bSERVICIO\b|\bSERVICE\b|\bSRV\b/],
  ["INSPECCION", /\bINSPECC?ION\b|\bINSPECTION\b|\bCHECK\b/],
  ["ADD", /\bADD\b/],
];

const PRIORITIES: [label: string, pattern: RegExp][] = [
  ["NO_GO", /\bNO[ -]?GO\b/],
  ["CRITICAL", /\bCRITICA?L?\b|\bURGENTE\b/],
  ["GO_IF", /\bGO[ -]?IF\b/],
  ["NORMAL", /\bNORMAL\b|\bRUTINA\b/],
];

function matchLabel(text: string, table: [string, RegExp][]): string | null {
  return matchLabelWithText(text, table)?.label ?? null;
}

/** Same lookup, but also returns the literal text that matched, so the caller
 * can strip it out of the free-text remainder. */
function matchLabelWithText(
  text: string,
  table: [string, RegExp][],
): { label: string; matched: string } | null {
  for (const [label, pattern] of table) {
    const found = text.match(pattern);
    if (found) return { label, matched: found[0] };
  }
  return null;
}

export function normalizeRegistration(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = String(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned || null;
}

/** Extracts the first date it can recognise, as YYYY-MM-DD. */
export function findDate(text: string): string | null {
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    if (day > 31 || month > 12) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

export function parsePlannerText(text: string): PlannerParseResult {
  const upper = text.toUpperCase();
  const headerMatch = upper.match(REGISTRATION);
  const documentMatricula = headerMatch ? headerMatch[1] : null;
  const documentDate = findDate(text);

  const tasks: PlannerTask[] = [];
  const seen = new Set<string>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (line.length < 6) continue;

    const lineUpper = line.toUpperCase();
    const codeMatch = lineUpper.match(TASK_CODE);
    if (!codeMatch) continue;

    const codigo = codeMatch[1].replace(/\//g, "-");

    // A registration on the line itself wins over the document header, since one
    // sheet can list work for more than one aircraft.
    const lineReg = lineUpper.match(REGISTRATION);
    const matricula = normalizeRegistration(lineReg ? lineReg[1] : documentMatricula);

    const dedupKey = `${matricula ?? ""}|${codigo}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    // Whatever is left after removing the structured tokens is the description.
    let descripcion = line
      .replace(new RegExp(codeMatch[1].replace(/[/-]/g, "[-/]"), "i"), " ")
      .replace(/\s+/g, " ")
      .trim();
    if (lineReg) descripcion = descripcion.replace(new RegExp(lineReg[1], "i"), " ").trim();

    // The priority is a column label, not prose: leaving it in would show up as
    // "NO GO Revision tren principal" in the task description.
    const priority = matchLabelWithText(lineUpper, PRIORITIES);
    if (priority) {
      descripcion = descripcion
        .replace(new RegExp(priority.matched.replace(/[ -]/g, "[ -]?"), "i"), " ")
        .replace(/\s+/g, " ")
        .trim();
    }
    descripcion = descripcion.replace(/^[-–—:|.\s]+|[-–—:|\s]+$/g, "").trim();

    tasks.push({
      tipoTarea: matchLabel(lineUpper, TASK_TYPES),
      codigo,
      prioridad: priority?.label ?? null,
      descripcion: descripcion || null,
      matriculaAvion: matricula,
      fecha: findDate(line) ?? documentDate,
      estado: 0,
    });
  }

  return {
    matricula: normalizeRegistration(documentMatricula),
    fecha: documentDate,
    tasks,
  };
}

export const PLANNER_AI_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["matricula", "fecha", "tasks"],
  properties: {
    matricula: { type: ["string", "null"], description: "Aircraft registration, e.g. EC-NFP" },
    fecha: { type: ["string", "null"], description: "YYYY-MM-DD" },
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tipo_tarea", "codigo", "prioridad", "descripcion", "matricula_avion", "fecha"],
        properties: {
          tipo_tarea: { type: ["string", "null"] },
          codigo: { type: "string" },
          prioridad: { type: ["string", "null"] },
          descripcion: { type: ["string", "null"] },
          matricula_avion: { type: ["string", "null"] },
          fecha: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

export interface PlannerAiPayload {
  matricula: string | null;
  fecha: string | null;
  tasks: {
    tipo_tarea: string | null;
    codigo: string;
    prioridad: string | null;
    descripcion: string | null;
    matricula_avion: string | null;
    fecha: string | null;
  }[];
}

export function aiPayloadToTasks(payload: PlannerAiPayload): PlannerParseResult {
  const documentMatricula = normalizeRegistration(payload.matricula);
  const documentDate = payload.fecha?.match(/^\d{4}-\d{2}-\d{2}$/) ? payload.fecha : null;

  const tasks: PlannerTask[] = [];
  const seen = new Set<string>();

  for (const task of payload.tasks ?? []) {
    const codigo = String(task.codigo ?? "").trim().toUpperCase();
    if (!codigo) continue;

    const matricula = normalizeRegistration(task.matricula_avion) ?? documentMatricula;
    const dedupKey = `${matricula ?? ""}|${codigo}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    const fecha = task.fecha?.match(/^\d{4}-\d{2}-\d{2}$/) ? task.fecha : documentDate;

    tasks.push({
      tipoTarea: task.tipo_tarea?.trim() || null,
      codigo,
      prioridad: task.prioridad?.trim() || null,
      descripcion: task.descripcion?.trim() || null,
      matriculaAvion: matricula,
      fecha,
      estado: 0,
    });
  }

  return { matricula: documentMatricula, fecha: documentDate, tasks };
}

// ---------------------------------------------------------------------------
// Self-check: `deno run supabase/functions/_shared/planner-parse.ts`
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const assert = (cond: unknown, msg: string) => {
    if (!cond) throw new Error(`FAIL: ${msg}`);
  };

  assert(normalizeRegistration("EC-NFP") === "ECNFP", "registration normalized");
  assert(normalizeRegistration("ec nfp") === "ECNFP", "registration case/space insensitive");
  assert(normalizeRegistration("") === null, "empty registration is null");
  assert(normalizeRegistration(null) === null, "null registration is null");

  assert(findDate("2025-09-01") === "2025-09-01", "iso date");
  assert(findDate("01/09/2025") === "2025-09-01", "dmy date");
  assert(findDate("1.9.25") === "2025-09-01", "short year date");
  assert(findDate("45/99/2025") === null, "impossible date rejected");
  assert(findDate("sin fecha") === null, "no date");

  const sheet = [
    "HOJA DE TRABAJO EC-NFP  Fecha: 01/09/2025",
    "MEL-2201 MEL NO-GO Revisar luz de posicion ala derecha",
    "PRE-0455 PREVUELO NORMAL Inspeccion prevuelo completa",
    "SRV/0912 SERVICIO CRITICAL Carga de nitrogeno tren principal",
    "MEL-2201 duplicada, debe ignorarse",
    "Notas generales del turno sin codigo",
  ].join("\n");

  const parsed = parsePlannerText(sheet);
  assert(parsed.matricula === "ECNFP", `document matricula got "${parsed.matricula}"`);
  assert(parsed.fecha === "2025-09-01", `document date got "${parsed.fecha}"`);
  assert(parsed.tasks.length === 3, `expected 3 tasks, got ${parsed.tasks.length}`);

  const mel = parsed.tasks[0];
  assert(mel.codigo === "MEL-2201", `codigo got "${mel.codigo}"`);
  assert(mel.tipoTarea === "MEL", `tipo got "${mel.tipoTarea}"`);
  assert(mel.prioridad === "NO_GO", `prioridad got "${mel.prioridad}"`);
  assert(mel.matriculaAvion === "ECNFP", `matricula got "${mel.matriculaAvion}"`);
  assert(mel.fecha === "2025-09-01", "task inherits document date");
  assert(mel.descripcion?.includes("Revisar luz"), `descripcion got "${mel.descripcion}"`);
  assert(mel.estado === 0, "new task starts open");
  // The priority label belongs in its own field, not glued to the description.
  assert(!/NO.?GO/i.test(mel.descripcion ?? ""), `priority left in descripcion: "${mel.descripcion}"`);
  assert(
    !/\bNORMAL\b/i.test(parsed.tasks[1].descripcion ?? ""),
    `priority left in descripcion: "${parsed.tasks[1].descripcion}"`,
  );

  assert(parsed.tasks[1].tipoTarea === "PREVUELO", `tipo got "${parsed.tasks[1].tipoTarea}"`);
  assert(parsed.tasks[1].prioridad === "NORMAL", "normal priority");
  assert(parsed.tasks[2].codigo === "SRV-0912", `slash code normalized, got "${parsed.tasks[2].codigo}"`);
  assert(parsed.tasks[2].prioridad === "CRITICAL", "critical priority");

  // The sheet header must not become a task: "EC-NFP 2025-09-01" used to be read
  // as the code "NFP 2025".
  const multi = parsePlannerText([
    "HOJA EC-NFP 2025-09-01",
    "ADD-3001 ADD Revisar EC-OBM puerta de carga",
  ].join("\n"));
  assert(multi.tasks.length === 1, `header must not be a task, got ${multi.tasks.length}`);
  // A registration on the line overrides the one in the header.
  assert(multi.tasks[0].matriculaAvion === "ECOBM", `line registration wins, got "${multi.tasks[0].matriculaAvion}"`);
  assert(multi.tasks[0].codigo === "ADD-3001", `codigo got "${multi.tasks[0].codigo}"`);

  const ai = aiPayloadToTasks({
    matricula: "EC-MKN",
    fecha: "2025-09-02",
    tasks: [
      { tipo_tarea: "MEL", codigo: "mel-9001", prioridad: "NO_GO", descripcion: "x", matricula_avion: null, fecha: null },
      { tipo_tarea: "MEL", codigo: "MEL-9001", prioridad: null, descripcion: "dup", matricula_avion: null, fecha: null },
      { tipo_tarea: null, codigo: "", prioridad: null, descripcion: "sin codigo", matricula_avion: null, fecha: null },
    ],
  });
  assert(ai.tasks.length === 1, `AI dedup + empty code filter, got ${ai.tasks.length}`);
  assert(ai.tasks[0].codigo === "MEL-9001", "AI code uppercased");
  assert(ai.tasks[0].matriculaAvion === "ECMKN", "AI task inherits document registration");
  assert(ai.tasks[0].fecha === "2025-09-02", "AI task inherits document date");

  console.log("planner-parse self-check OK");
}
