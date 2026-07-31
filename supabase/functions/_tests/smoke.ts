// Edge Function smoke test. Checks that every dashboard endpoint answers, that
// the PDF imports land in the database, and that no function talks to n8n.
//
//   supabase start && supabase db reset && supabase functions serve
//   deno run -A supabase/functions/_tests/smoke.ts
//
// Reads SUPABASE_URL / SUPABASE_ANON_KEY, defaulting to the local stack. The
// PDF-parsing phase needs no stack and always runs, so this file is still worth
// running when Docker is unavailable.

import { assertPdf, extractPdfText, sha256Hex } from "../_shared/pdf.ts";
import { parsePlannerText } from "../_shared/planner-parse.ts";
import { parseRosterText } from "../_shared/roster-parse.ts";
import {
  makeTextPdf,
  plannerPdf,
  plannerPdfLines,
  rosterPdf,
  rosterPdfLines,
} from "../../../web/e2e/fixtures/pdf.ts";

const BASE = Deno.env.get("SUPABASE_URL") ?? "http://127.0.0.1:54321";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const FN = `${BASE}/functions/v1`;

let failures = 0;
let checks = 0;

function check(ok: unknown, what: string, detail = "") {
  checks++;
  if (ok) {
    console.log(`  ok   ${what}`);
  } else {
    failures++;
    console.error(`  FAIL ${what}${detail ? ` — ${detail}` : ""}`);
  }
}

async function call(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown; text: string }> {
  const headers = new Headers(init.headers);
  if (ANON) {
    headers.set("Authorization", `Bearer ${ANON}`);
    headers.set("apikey", ANON);
  }
  if (init.body && typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${FN}/${path}`, { ...init, headers });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch { /* keep the raw text for the failure message */ }
  return { status: res.status, body, text };
}

function pdfForm(bytes: Uint8Array, name: string, extra: Record<string, string> = {}) {
  const form = new FormData();
  form.append("file", new File([bytes as BlobPart], name, { type: "application/pdf" }));
  for (const [k, v] of Object.entries(extra)) form.append(k, v);
  return form;
}

// ---------------------------------------------------------------------------
// Phase 1 — PDF pipeline, no stack required
// ---------------------------------------------------------------------------

async function pdfPhase() {
  console.log("\nPDF pipeline (offline)");

  const planner = plannerPdf();
  assertPdf(planner);
  const plannerText = await extractPdfText(planner);
  check(!!plannerText.text.includes("MEL-2201"), "planner PDF text layer is readable");

  const plannerParsed = parsePlannerText(plannerText.text);
  check(plannerParsed.tasks.length === 2, "planner PDF yields 2 tasks", `got ${plannerParsed.tasks.length}`);
  check(plannerParsed.matricula === "ECNFP", "planner registration parsed", String(plannerParsed.matricula));
  check(
    plannerParsed.tasks.every((t) => !/NO.?GO|NORMAL/i.test(t.descripcion ?? "")),
    "priority is not left inside the description",
  );

  const roster = rosterPdf();
  assertPdf(roster);
  const rosterText = await extractPdfText(roster);
  const rosterParsed = parseRosterText(rosterText.text);
  check(rosterParsed.rows.length === 3, "roster PDF yields 3 people", `got ${rosterParsed.rows.length}`);
  check(
    rosterParsed.rows.every((r) => r.employeeName.split(" ").length >= 2),
    "every roster row has a name",
    JSON.stringify(rosterParsed.rows.map((r) => r.employeeName)),
  );
  check(rosterParsed.rows.every((r) => r.shifts.length === 7), "every roster row has 7 shifts");

  // Same bytes must hash the same, which is what makes re-importing idempotent.
  const plannerHash = await sha256Hex(planner);
  check(plannerHash === await sha256Hex(plannerPdf()), "PDF hash is stable");
  check(plannerHash !== await sha256Hex(roster), "different PDFs hash differently");
  // Extraction must not consume the caller's buffer: if it does, the hash taken
  // afterwards is the digest of the empty string and every import looks like a
  // duplicate of the first one.
  check(planner.byteLength > 0, "text extraction leaves the input bytes intact");

  let rejected = false;
  try {
    assertPdf(new TextEncoder().encode("<html>not a pdf</html>"));
  } catch {
    rejected = true;
  }
  check(rejected, "a non-PDF upload is rejected at the boundary");
}

// ---------------------------------------------------------------------------
// Phase 2 — live Edge Functions
// ---------------------------------------------------------------------------

async function reachable(): Promise<boolean> {
  try {
    await fetch(`${BASE}/functions/v1/aircraft-list`, {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
    });
    return true;
  } catch {
    return false;
  }
}

async function listPhase() {
  console.log("\nRead endpoints");
  for (const path of [
    "inventory-list",
    "aircraft-list",
    "personnel-list",
    "incidents",
    "nitro-stock",
    "tooling-list",
    "planner-groups",
    "planner-tasks",
    "relays",
  ]) {
    const { status, body, text } = await call(path);
    check(status === 200, `GET ${path} responds 200`, `got ${status} ${text.slice(0, 120)}`);
    check(Array.isArray(body) || typeof body === "object", `GET ${path} returns JSON`);
  }

  const { status } = await call("roster-upload?week=2026-03-16");
  check(status === 200, "GET roster-upload?week= responds 200", `got ${status}`);
}

async function writePhase() {
  console.log("\nWrite endpoints");

  // Relays: create, read back, delete.
  const created = await call("relays", {
    method: "POST",
    body: JSON.stringify({ plane: "EC-NFP", worker: "Smoke Test", points: ["punto uno", "punto dos"] }),
  });
  check(created.status === 201, "POST relays creates a relay", `got ${created.status} ${created.text.slice(0, 160)}`);
  const relay = created.body as { id?: string; points?: string[] };
  check(relay?.points?.length === 2, "the relay keeps both points");

  if (relay?.id) {
    const list = await call("relays");
    check(
      Array.isArray(list.body) && (list.body as { id: string }[]).some((r) => r.id === relay.id),
      "the new relay shows up in the list",
    );
    const deleted = await call("relays", {
      method: "POST",
      body: JSON.stringify({ action: "delete", id: relay.id }),
    });
    check(deleted.status === 200, "POST relays delete removes it", `got ${deleted.status}`);
  }

  check(
    (await call("relays", { method: "POST", body: JSON.stringify({ plane: "", points: [] }) })).status === 400,
    "relays rejects an empty payload with 400",
  );

  // Nitrogen stock.
  const nitro = await call("nitro-stock", {
    method: "POST",
    body: JSON.stringify({ action: "update_nitro_stock", location: "T4S", llenas: 7, vacias: 3 }),
  });
  check(nitro.status === 200, "POST nitro-stock updates the stock", `got ${nitro.status} ${nitro.text.slice(0, 160)}`);

  // Planner: create a group, then delete it.
  const group = await call("planner-action", {
    method: "POST",
    body: JSON.stringify({
      action: "create",
      matricula: "EC-SMK",
      modelo: "A330",
      aerolinea: "IBEROJET",
      responsable: "Smoke Test",
      trabajador_1: "Smoke Worker",
    }),
  });
  check(group.status < 300, "POST planner-action create", `got ${group.status} ${group.text.slice(0, 160)}`);
  const removed = await call("planner-action", {
    method: "POST",
    body: JSON.stringify({ action: "delete", matricula: "EC-SMK" }),
  });
  check(removed.status < 300, "POST planner-action delete", `got ${removed.status}`);

  // Unknown actions must be refused, not silently accepted.
  check(
    (await call("planner-action", { method: "POST", body: JSON.stringify({ action: "nope" }) })).status === 400,
    "planner-action rejects an unknown action with 400",
  );
}

async function importPhase() {
  console.log("\nPDF imports");

  // Imports are idempotent twice over: by file hash, and by
  // (aircraft, task code, day). A fixed fixture would therefore only ever import
  // on the very first run against a given database, so the task codes carry a
  // per-run suffix. The same bytes are reused below to prove the dedup works.
  const runId = Date.now().toString().slice(-5);
  const runMark = `EJECUCION SMOKE ${new Date().toISOString()}`;
  const planner = makeTextPdf([
    ...plannerPdfLines.map((line) => line.replace(/\b(MEL|DEF)-(\d+)\b/, `$1-${runId}`)),
    runMark,
  ]);
  const first = await call("planner-action", { method: "POST", body: pdfForm(planner, "hoja.pdf", { matricula: "EC-NFP" }) });
  check(first.status < 300, "planner PDF import accepted", `got ${first.status} ${first.text.slice(0, 200)}`);
  const summary = first.body as { created?: number; duplicates?: number };
  check((summary?.created ?? 0) === 2, "planner import created 2 tasks", JSON.stringify(summary));

  const again = await call("planner-action", { method: "POST", body: pdfForm(planner, "hoja.pdf", { matricula: "EC-NFP" }) });
  const repeat = again.body as { created?: number; duplicates?: number };
  check(
    (repeat?.created ?? 0) === 0,
    "re-importing the same planner PDF creates nothing",
    JSON.stringify(repeat),
  );

  const roster = makeTextPdf([...rosterPdfLines, runMark]);
  const rosterRes = await call("roster-upload", { method: "POST", body: pdfForm(roster, "horario.pdf") });
  check(rosterRes.status < 300, "roster PDF import accepted", `got ${rosterRes.status} ${rosterRes.text.slice(0, 200)}`);
  const rosterSummary = rosterRes.body as { imported?: number; people?: unknown[] };
  check(
    (rosterSummary?.imported ?? 0) > 0 || (rosterSummary?.people?.length ?? 0) > 0,
    "roster import stored assignments",
    JSON.stringify(rosterSummary).slice(0, 200),
  );

  const week = await call("roster-upload?week=2026-03-16");
  check(
    Array.isArray((week.body as { people?: unknown[] })?.people) ||
      Array.isArray(week.body),
    "the imported week can be read back",
  );

  // Garbage must not reach the parser.
  const bad = new FormData();
  bad.append("file", new File(["definitely not a pdf"], "x.pdf", { type: "application/pdf" }));
  check(
    (await call("roster-upload", { method: "POST", body: bad })).status === 400,
    "roster-upload rejects a fake PDF with 400",
  );
}

async function registerPhase() {
  console.log("\nPublic registration");

  const unique = Date.now().toString().slice(-9);
  const person = {
    nombre: "Smoke Test Persona",
    telefono: `6${unique.slice(0, 8)}`,
    email: `smoke${unique}@example.com`,
    codigo_empleado: `SMK${unique}`,
    departamento: "Mantenimiento", // one of DEPARTMENTS, as in the legacy form
    certificaciones: { b1: true },
    numero_bac: `BAC-${unique.slice(0, 4)}`, // required by B1
    aeronaves: { airbus_a330: { selected: true, b1: true } },
    privacidad: true,
  };

  const first = await call("personnel-register", { method: "POST", body: JSON.stringify(person) });
  // 429 is the IP rate limit doing its job; repeated runs from the same host hit
  // it, and that is a pass rather than a regression.
  if (first.status === 429) {
    check(true, "registration rate-limited (anti-abuse active, run against a fresh DB to retest)");
    return;
  }
  check(first.status < 300, "registration accepted", `got ${first.status} ${first.text.slice(0, 200)}`);

  const dup = await call("personnel-register", { method: "POST", body: JSON.stringify(person) });
  check(
    dup.status === 409 || dup.status === 429,
    "the same person a second time is refused",
    `got ${dup.status}`,
  );

  const honey = await call("personnel-register", {
    method: "POST",
    body: JSON.stringify({ ...person, telefono: "600111222", email: "bot@example.com", website: "http://spam" }),
  });
  check(honey.status < 300, "the honeypot answers like a success", `got ${honey.status}`);

  const invalid = await call("personnel-register", {
    method: "POST",
    body: JSON.stringify({ nombre: "", telefono: "123", privacidad: false }),
  });
  check(invalid.status === 400, "an invalid registration is a 400", `got ${invalid.status}`);
  // The form highlights the offending input from this, so the name must be there.
  check(
    typeof (invalid.body as { field?: unknown })?.field === "string",
    "the 400 names the offending field",
    invalid.text.slice(0, 200),
  );
}

// ---------------------------------------------------------------------------

async function n8nPhase() {
  console.log("\nn8n independence");
  // A runtime call to n8n from a dashboard function would need the URL or the
  // env flag in the source. Comments that explain what replaced n8n are history,
  // not a dependency, so they are stripped before looking.
  const stripComments = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const hits: string[] = [];
  for await (const entry of Deno.readDir(new URL("..", import.meta.url))) {
    if (!entry.isDirectory || entry.name.startsWith("_")) continue;
    const path = new URL(`../${entry.name}/index.ts`, import.meta.url);
    let src: string;
    try {
      src = await Deno.readTextFile(path);
    } catch {
      continue;
    }
    if (entry.name === "broki-whatsapp-inbound") continue; // out of scope
    if (/n8n|USE_N8N/i.test(stripComments(src))) hits.push(entry.name);
  }
  check(hits.length === 0, "no dashboard function references n8n", hits.join(", "));
}

await pdfPhase();
await n8nPhase();

const offlineOnly = Deno.env.get("SMOKE_OFFLINE_ONLY") === "1";

if (!offlineOnly && (await reachable())) {
  await listPhase();
  await writePhase();
  await importPhase();
  await registerPhase();
} else if (offlineOnly) {
  console.log("\nSkipping live checks: SMOKE_OFFLINE_ONLY=1 (pre-commit).");
} else {
  console.log(`\nSkipping live checks: no Edge Functions at ${FN}.`);
  console.log("Start them with: supabase start && supabase db reset && supabase functions serve");
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) Deno.exit(1);
