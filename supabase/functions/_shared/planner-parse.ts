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

// ---------------------------------------------------------------------------
// Tabular parser — for exported workload PDFs (daily_workload_*.pdf) whose
// text layer preserves fixed-width column layout:
//   Tipo | Código | A/C | Prioridad | Descripción | Realizado
//
// A header row containing "tipo" + "codigo" + "prioridad" triggers this path.
// Everything after a notes-separator line ("--- Notas Generales ---") is
// excluded so general remarks never become tasks.
//
// Falls back gracefully: if no header is found, returns an empty result and
// the caller should continue to parsePlannerText (legacy).
// ---------------------------------------------------------------------------

/** Returns the character index of the first pattern that matches, or -1. */
function findColPos(header: string, ...patterns: RegExp[]): number {
  for (const p of patterns) {
    const i = header.search(p);
    if (i >= 0) return i;
  }
  return -1;
}

export function parsePlannerTable(text: string): PlannerParseResult {
  const lines = text.split(/\r?\n/);

  // Detect the header row: must contain "tipo" … "codigo"/"código" … "prioridad".
  const HEADER_RE = /\btipo\b.{0,40}c[oó]digo.{0,40}prioridad/i;
  const hi = lines.findIndex((l) => HEADER_RE.test(l));
  if (hi === -1) return { matricula: null, fecha: null, tasks: [] };

  // Extract document-level metadata from pre-header lines.
  const preamble = lines.slice(0, hi).join("\n").toUpperCase();
  const documentDate = findDate(lines.slice(0, hi).join("\n"));
  const docReg = preamble.match(REGISTRATION);
  const documentMatricula = docReg ? normalizeRegistration(docReg[1]) : null;

  // Locate each column's start position from the lowercased header.
  const h = lines[hi].toLowerCase();
  const pos: Record<string, number> = {
    tipo:        findColPos(h, /\btipo\b/),
    codigo:      findColPos(h, /\bc[oó]digo\b/, /\bcod\b/),
    ac:          findColPos(h, /\ba\/c\b/, /\bmatricula\b/),
    prioridad:   findColPos(h, /\bprioridad\b/),
    descripcion: findColPos(h, /\bdescripci[oó]n\b/, /\bdescripcion\b/),
    realizado:   findColPos(h, /\brealizado\b/, /\bread\b/),
  };

  // Require at least codigo and prioridad columns.
  if (pos.codigo < 0 || pos.prioridad < 0) return { matricula: null, fecha: null, tasks: [] };

  // Build sorted column boundaries so slicing is O(1) per row.
  const cols = Object.entries(pos)
    .filter(([, s]) => s >= 0)
    .sort(([, a], [, b]) => a - b)
    .map(([name, start]) => ({ name, start }));

  const slice = (line: string, colName: string): string => {
    const i = cols.findIndex((c) => c.name === colName);
    if (i < 0) return "";
    const from = cols[i].start;
    const to = i + 1 < cols.length ? cols[i + 1].start : line.length;
    return line.slice(from, Math.min(to, line.length)).trim();
  };

  // Notes-section sentinel patterns — anything after these lines is excluded.
  const NOTES_RE = /^[-—=*]{3,}\s*(notas?|observaciones?|general)/i;
  const NOTES_START_RE = /^(notas?|observaciones?)\s*generales?/i;

  const tasks: PlannerTask[] = [];
  const seen = new Set<string>();

  for (let i = hi + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (NOTES_RE.test(trimmed) || NOTES_START_RE.test(trimmed)) break;

    const codigoRaw = slice(line, "codigo").toUpperCase().replace(/\//g, "-");
    if (!codigoRaw || !TASK_CODE.test(codigoRaw)) continue;

    const acRaw       = slice(line, "ac");
    const matricula   = normalizeRegistration(acRaw) ?? documentMatricula;
    const dedupKey    = `${matricula ?? ""}|${codigoRaw}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    const tipoRaw  = slice(line, "tipo").toUpperCase();
    const prioRaw  = slice(line, "prioridad").toUpperCase();
    const descRaw  = slice(line, "descripcion");
    const realizRaw = slice(line, "realizado").toUpperCase();

    tasks.push({
      tipoTarea:     matchLabel(tipoRaw, TASK_TYPES) ?? (tipoRaw || null),
      codigo:        codigoRaw,
      prioridad:     matchLabel(prioRaw, PRIORITIES) ?? (prioRaw || null),
      descripcion:   descRaw || null,
      matriculaAvion: matricula,
      fecha:         findDate(line) ?? documentDate,
      // Realizado column: X / ✓ / ✔ / S / SI / YES / 1 → done.
      estado:        /^(x|✓|✔|s|si|yes|1)$/i.test(realizRaw) ? 1 : 0,
    });
  }

  return { matricula: documentMatricula, fecha: documentDate, tasks };
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

  // --- parsePlannerTable ---
  const tableSheet = [
    "DAILY PRIORITY - MADBRK",
    "FECHA: 2026-08-01  A/C: EC-NFP",
    "Tipo   Codigo    A/C     Prioridad  Descripcion                        Realizado",
    "MEL    MEL-2201  EC-NFP  NO_GO      Revisar luz de posicion ala izq    X",
    "CDL    CDL-0340  EC-NFP  CRITICAL   Panel de acceso de servicio suelto",
    "PRE    PRE-0455  EC-NFP  NORMAL     Inspeccion prevuelo completa       X",
    "SRV    SRV-0912  EC-OBM  NORMAL     Carga de nitrogeno tren principal",
    "--- Notas Generales ---",
    "Confirmar disponibilidad de herramientas antes de iniciar.",
    "MEL-9999 esta fila esta en notas y NO debe importarse.",
  ].join("\n");

  const tbl = parsePlannerTable(tableSheet);
  assert(tbl.tasks.length === 4, `table: expected 4 tasks, got ${tbl.tasks.length}`);
  assert(tbl.fecha === "2026-08-01", `table: document date got "${tbl.fecha}"`);
  assert(tbl.matricula === "ECNFP", `table: document matricula got "${tbl.matricula}"`);

  const tMel = tbl.tasks.find((t) => t.codigo === "MEL-2201");
  assert(tMel, "table: MEL-2201 not found");
  assert(tMel!.estado === 1, `table: MEL-2201 Realizado=X → estado 1, got ${tMel!.estado}`);
  assert(tMel!.prioridad === "NO_GO", `table: MEL-2201 prioridad got "${tMel!.prioridad}"`);
  assert(tMel!.tipoTarea === "MEL", `table: MEL-2201 tipo got "${tMel!.tipoTarea}"`);
  assert(tMel!.matriculaAvion === "ECNFP", `table: MEL-2201 A/C got "${tMel!.matriculaAvion}"`);

  const tCdl = tbl.tasks.find((t) => t.codigo === "CDL-0340");
  assert(tCdl, "table: CDL-0340 not found");
  assert(tCdl!.estado === 0, `table: CDL-0340 no Realizado → estado 0, got ${tCdl!.estado}`);
  assert(tCdl!.prioridad === "CRITICAL", `table: CDL-0340 prioridad got "${tCdl!.prioridad}"`);

  const tObm = tbl.tasks.find((t) => t.codigo === "SRV-0912");
  assert(tObm, "table: SRV-0912 not found");
  assert(tObm!.matriculaAvion === "ECOBM", `table: SRV-0912 A/C EC-OBM → ECOBM, got "${tObm!.matriculaAvion}"`);

  const tBad = tbl.tasks.find((t) => t.codigo === "MEL-9999");
  assert(!tBad, `table: MEL-9999 in notas must not be imported, got task`);

  // No-header input returns empty (triggers legacy fallback in the caller).
  const noHdr = parsePlannerTable("MEL-2201 NO GO Revisar luz");
  assert(noHdr.tasks.length === 0, `table: no-header input must return empty, got ${noHdr.tasks.length}`);

  console.log("parsePlannerTable self-check OK");
}
