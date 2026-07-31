// Roster PDF parsing. The legacy stack posted the PDF to the n8n "horario"
// webhook and the dashboard never stored the result, so the frontend shipped a
// hardcoded ROSTER_DATA array instead. This turns the same PDF into rows.

export interface RosterShift {
  code: string;
  start: string | null;
  end: string | null;
}

export interface RosterRow {
  employeeCode: string | null;
  employeeName: string;
  cert: string | null;
  airlineTeam: string | null;
  /** Seven entries, Monday first. */
  shifts: RosterShift[];
}

export interface RosterParseResult {
  rows: RosterRow[];
  weekStart: string | null;
  weekEnd: string | null;
}

const DAYS_PER_WEEK = 7;

// "07:00-19:00", "7:00 - 19:00", "0700-1900"
const TIME_RANGE = /\b(\d{1,2})[:.]?(\d{2})\s*[-–—/]\s*(\d{1,2})[:.]?(\d{2})\b/;

// Anchored variant. Used when deciding whether adjacent tokens should be
// rejoined: without the anchors, "07:00-18:00 07:00-18:00 V" also "matches" and
// three separate shifts collapse into one.
const WHOLE_TIME_RANGE = /^\d{1,2}[:.]?\d{2}\s*[-–—/]\s*\d{1,2}[:.]?\d{2}$/;

// Non-working / absence codes seen in the AENA sheets. Anything else that is a
// short all-caps token is kept verbatim rather than dropped, so an unknown code
// shows up in the UI instead of silently becoming a day off.
const ABSENCE_CODES = new Set([
  "L", "B", "V", "FS", "FSL", "FBL", "FL", "BL", "LD", "P", "A", "AP", "F", "SL", "IT",
]);

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function normalizeShift(raw: string): RosterShift | null {
  const token = raw.trim().replace(/\s+/g, " ");
  if (!token) return null;

  const range = token.match(TIME_RANGE);
  if (range) {
    const [, h1, m1, h2, m2] = range;
    const startH = Number(h1);
    const endH = Number(h2);
    if (startH > 23 || endH > 24 || Number(m1) > 59 || Number(m2) > 59) return null;
    const start = `${pad(startH)}:${m1}`;
    // Legacy sheets write a shift ending at midnight as 00:00; keep the literal
    // value and let the consumer treat end <= start as an overnight shift.
    const end = `${pad(endH % 24)}:${m2}`;
    return { code: `${start}-${end}`, start, end };
  }

  const upper = token.toUpperCase();
  if (ABSENCE_CODES.has(upper)) return { code: upper, start: null, end: null };

  // Unknown short codes are preserved; long free text is not a shift.
  if (/^[A-Z]{1,4}$/.test(upper)) return { code: upper, start: null, end: null };

  return null;
}

// Order matters: "CAT A" is checked as a unit so its trailing "A" is not also
// reported as a separate certification.
const CERT_PATTERNS: [label: string, pattern: RegExp][] = [
  ["CAT A", /\bCAT[ -]?A\b|\bCATA\b/],
  ["B1", /\bB1\b/],
  ["B2", /\bB2\b/],
  ["HELPER", /\bHELPER\b/],
];

function extractCert(text: string): string | null {
  const upper = text.toUpperCase();
  const found = CERT_PATTERNS.filter(([, re]) => re.test(upper)).map(([label]) => label);
  return found.length > 0 ? found.join(", ") : null;
}

/**
 * Heuristic line parser. Each roster line looks roughly like
 *   "<cert> <name> <employee code> <7 shift tokens>"
 * with the column order varying between exports, so shifts are located by
 * pattern and the leading text is split into name / code / cert afterwards.
 */
export function parseRosterText(text: string): RosterParseResult {
  const rows: RosterRow[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (line.length < 8) continue;

    // Collect shift tokens from the right-hand side of the line.
    const tokens = line.split(" ");
    const shifts: RosterShift[] = [];
    let boundary = tokens.length;

    for (let i = tokens.length - 1; i >= 0 && shifts.length < DAYS_PER_WEEK; i--) {
      let matched: { shift: RosterShift; consumed: number } | null = null;

      // A whole token wins. Rejoining neighbours is only for a range the text
      // layer split across tokens ("07:00 - 19:00"), and the joined candidate
      // must be nothing but that range.
      const single = normalizeShift(tokens[i]);
      if (single) {
        matched = { shift: single, consumed: 1 };
      } else {
        for (const consumed of [2, 3]) {
          const from = i - consumed + 1;
          if (from < 0) break;
          const candidate = tokens.slice(from, i + 1).join(" ");
          if (!WHOLE_TIME_RANGE.test(candidate)) continue;
          const shift = normalizeShift(candidate);
          if (shift) {
            matched = { shift, consumed };
            break;
          }
        }
      }

      if (!matched) break;

      shifts.unshift(matched.shift);
      boundary = i - matched.consumed + 1;
      i -= matched.consumed - 1;
    }

    if (shifts.length !== DAYS_PER_WEEK) continue;

    const head = tokens.slice(0, boundary).join(" ").trim();
    if (!head) continue;

    // Employee code: standalone 2-5 digit number, optionally prefixed (A-424).
    const codeMatch = head.match(/\b([A-Z]-?\d{2,5}|\d{2,5})\b/);
    const employeeCode = codeMatch ? codeMatch[1] : null;

    const cert = extractCert(head);

    let name = head;
    if (employeeCode) name = name.replace(employeeCode, " ");
    if (cert) {
      for (const token of cert.split(", ")) {
        name = name.replace(new RegExp(`\\b${token.replace(" ", "[ -]?")}\\b`, "gi"), " ");
      }
    }
    name = name.replace(/[|,;:]+/g, " ").replace(/\s+/g, " ").trim();

    // A roster row must name a person; two words minimum avoids catching
    // header rows and column labels.
    if (name.split(" ").length < 2 || name.length < 5) continue;
    // Header and footer rows. The trailing \b matters: without it "MAR" (martes)
    // also discards anyone called Mario, Marta or Marcos.
    if (/^(NOMBRE|CERT|TOTAL|SEMANA|TURNO|LUN|MAR|MIE|JUE|VIE|SAB|DOM)\b/i.test(name)) continue;

    rows.push({
      employeeCode,
      employeeName: name,
      cert,
      airlineTeam: detectAirlineTeam(line),
      shifts,
    });
  }

  return { rows, ...findWeekRange(text) };
}

/**
 * Airline is only set when the document says so. The legacy dashboard faked it
 * with a hardcoded set of table row indices (W2F_ROWS), which silently mislabels
 * everyone as soon as the roster order changes.
 */
export function detectAirlineTeam(line: string): string | null {
  const upper = line.toUpperCase();
  if (/\bW2F(LY)?\b|WORLD ?2 ?FLY/.test(upper)) return "w2f";
  if (/\bIBEROJET\b|\bEVE\b/.test(upper)) return "iberojet";
  return null;
}

const MONTHS: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
};

/** Finds the week the sheet covers; falls back to null so the caller can decide. */
export function findWeekRange(text: string): { weekStart: string | null; weekEnd: string | null } {
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const start = `${iso[1]}-${iso[2]}-${iso[3]}`;
    return { weekStart: start, weekEnd: addDays(start, 6) };
  }

  // "01/09/2025" or "01-09-2025"
  const dmy = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (dmy) {
    const start = `${dmy[3]}-${pad(Number(dmy[2]))}-${pad(Number(dmy[1]))}`;
    return { weekStart: start, weekEnd: addDays(start, 6) };
  }

  // "1 de septiembre de 2025" / "1 sep 2025"
  const named = text.toLowerCase().match(/\b(\d{1,2})\s*(?:de\s+)?([a-záéíóú]{3})[a-záéíóú]*\s*(?:de\s+)?(\d{4})\b/);
  if (named && MONTHS[named[2]]) {
    const start = `${named[3]}-${pad(MONTHS[named[2]])}-${pad(Number(named[1]))}`;
    return { weekStart: start, weekEnd: addDays(start, 6) };
  }

  return { weekStart: null, weekEnd: null };
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing `date`, in ISO form. */
export function mondayOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const offset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

export const ROSTER_AI_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["week_start", "rows"],
  properties: {
    week_start: { type: ["string", "null"], description: "Monday of the week, YYYY-MM-DD" },
    rows: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["employee_name", "employee_code", "cert", "airline_team", "shifts"],
        properties: {
          employee_name: { type: "string" },
          employee_code: { type: ["string", "null"] },
          cert: { type: ["string", "null"] },
          airline_team: { type: ["string", "null"], enum: ["iberojet", "w2f", null] },
          shifts: {
            type: "array",
            minItems: 7,
            maxItems: 7,
            items: { type: "string", description: "HH:MM-HH:MM or an absence code such as L or V" },
          },
        },
      },
    },
  },
} as const;

export interface RosterAiPayload {
  week_start: string | null;
  rows: {
    employee_name: string;
    employee_code: string | null;
    cert: string | null;
    airline_team: string | null;
    shifts: string[];
  }[];
}

export function aiPayloadToRows(payload: RosterAiPayload): RosterParseResult {
  const rows: RosterRow[] = [];

  for (const row of payload.rows ?? []) {
    if (!row.employee_name?.trim()) continue;
    const shifts = (row.shifts ?? [])
      .slice(0, DAYS_PER_WEEK)
      .map((s) => normalizeShift(s) ?? { code: String(s ?? "").trim() || "L", start: null, end: null });
    while (shifts.length < DAYS_PER_WEEK) shifts.push({ code: "L", start: null, end: null });

    rows.push({
      employeeCode: row.employee_code?.trim() || null,
      employeeName: row.employee_name.trim(),
      cert: row.cert?.trim() || null,
      airlineTeam: row.airline_team === "w2f" || row.airline_team === "iberojet" ? row.airline_team : null,
      shifts,
    });
  }

  const weekStart = payload.week_start?.match(/^\d{4}-\d{2}-\d{2}$/) ? payload.week_start : null;
  return { rows, weekStart, weekEnd: weekStart ? addDays(weekStart, 6) : null };
}

// ---------------------------------------------------------------------------
// Self-check: `deno run supabase/functions/_shared/roster-parse.ts`
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const assert = (cond: unknown, msg: string) => {
    if (!cond) throw new Error(`FAIL: ${msg}`);
  };

  assert(normalizeShift("07:00-19:00")?.start === "07:00", "time range start");
  assert(normalizeShift("7:00 - 19:00")?.code === "07:00-19:00", "spaced range normalizes");
  assert(normalizeShift("0700-1900")?.end === "19:00", "compact range");
  assert(normalizeShift("14:00-00:00")?.end === "00:00", "midnight end preserved");
  assert(normalizeShift("L")?.code === "L", "absence code");
  assert(normalizeShift("99:99-10:00") === null, "invalid hours rejected");
  assert(normalizeShift("Observaciones generales") === null, "free text rejected");
  assert(normalizeShift("XYZ")?.code === "XYZ", "unknown short code kept");

  assert(detectAirlineTeam("MARIO W2FLY 07:00-19:00") === "w2f", "w2f detected");
  assert(detectAirlineTeam("MARIO IBEROJET") === "iberojet", "iberojet detected");
  assert(detectAirlineTeam("MARIO 07:00-19:00") === null, "no airline guessed");

  assert(findWeekRange("Semana 2025-09-01").weekStart === "2025-09-01", "iso week");
  assert(findWeekRange("Semana del 01/09/2025").weekStart === "2025-09-01", "dmy week");
  assert(findWeekRange("1 de septiembre de 2025").weekStart === "2025-09-01", "named month week");
  assert(findWeekRange("sin fecha").weekStart === null, "missing week is null");
  assert(addDays("2025-09-01", 6) === "2025-09-07", "addDays");
  assert(mondayOf(new Date("2025-09-04T10:00:00Z")) === "2025-09-01", "mondayOf mid-week");
  assert(mondayOf(new Date("2025-09-07T10:00:00Z")) === "2025-09-01", "mondayOf sunday");

  const sheet = [
    "HORARIO SEMANA 01/09/2025",
    "Cert Nombre ID Lun Mar Mie Jue Vie Sab Dom",
    "B1, B2 Mario Lorenzo 241 07:00-19:00 07:00-19:00 L L 07:00-18:00 07:00-18:00 V",
    "B1 Enrique Garcia 265 07:00-17:00 07:00-17:00 06:00-16:00 08:00-16:00 L L L",
    "CAT A Enrique Aguado A-424 10:00-18:00 09:00-17:00 L FS L L 09:00-19:00",
    "Total horas 120",
  ].join("\n");

  const parsed = parseRosterText(sheet);
  assert(parsed.rows.length === 3, `expected 3 rows, got ${parsed.rows.length}`);
  assert(parsed.weekStart === "2025-09-01", "week start from sheet");

  const mario = parsed.rows[0];
  assert(mario.employeeName === "Mario Lorenzo", `name got "${mario.employeeName}"`);
  assert(mario.employeeCode === "241", `code got "${mario.employeeCode}"`);
  assert(mario.cert === "B1, B2", `cert got "${mario.cert}"`);
  assert(mario.shifts.length === 7, "seven shifts");
  assert(mario.shifts[2].code === "L", "wednesday off");
  assert(mario.shifts[6].code === "V", "sunday vacation");

  const aguado = parsed.rows[2];
  assert(aguado.employeeCode === "A-424", `prefixed code got "${aguado.employeeCode}"`);
  assert(aguado.cert === "CAT A", `cert got "${aguado.cert}"`);
  assert(aguado.employeeName === "Enrique Aguado", `name got "${aguado.employeeName}"`);

  const ai = aiPayloadToRows({
    week_start: "2025-09-01",
    rows: [{
      employee_name: "Test Person",
      employee_code: "999",
      cert: "B1",
      airline_team: "w2f",
      shifts: ["07:00-19:00", "L", "L", "L", "L", "L"],
    }],
  });
  assert(ai.rows[0].shifts.length === 7, "AI rows padded to seven days");
  assert(ai.rows[0].airlineTeam === "w2f", "AI airline preserved");

  console.log("roster-parse self-check OK");
}
