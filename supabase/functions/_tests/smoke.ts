// Edge Function smoke test. Checks that every dashboard endpoint answers, that
// the PDF imports land in the database, and that no function talks to n8n.
//
//   supabase start && supabase db reset && supabase functions serve
//   deno run -A supabase/functions/_tests/smoke.ts
//
// Reads SUPABASE_URL / SUPABASE_ANON_KEY, defaulting to the local stack. The
// PDF-parsing phase needs no stack and always runs, so this file is still worth
// running when Docker is unavailable.
//
// When BROKI_REMOTE_TEST_SECRET is set, all live calls carry service headers
// (X-Broki-Service-Id: remote-smoke, etc.) and the test also verifies that
// auth hardening works (wrong secret → 401, missing headers → 401, etc.).

import { assertPdf, extractPdfText, sha256Hex } from "../_shared/pdf.ts";
import { parsePlannerText } from "../_shared/planner-parse.ts";
import { parseRosterText } from "../_shared/roster-parse.ts";
import {
  makeTextPdf,
  plannerPdf,
  plannerPdfLines,
  rosterPdf,
  rosterPdfLines,
} from "./fixtures/pdf.ts";

const BASE = Deno.env.get("SUPABASE_URL") ?? "http://127.0.0.1:54321";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const FN = `${BASE}/functions/v1`;
const SMOKE_SECRET = Deno.env.get("BROKI_REMOTE_TEST_SECRET") ?? "";
const SMOKE_RUN_ID = Deno.env.get("SMOKE_RUN_ID") ?? crypto.randomUUID();

let failures = 0;
let checks = 0;

// Track entities created during the run for cleanup
const created: { type: string; id: string }[] = [];

function check(ok: unknown, what: string, detail = "") {
  checks++;
  if (ok) {
    console.log(`  ok   ${what}`);
  } else {
    failures++;
    console.error(`  FAIL ${what}${detail ? ` — ${detail}` : ""}`);
  }
}

function makeServiceHeaders(): Record<string, string> {
  if (!SMOKE_SECRET) return {};
  return {
    "X-Broki-Service-Id": "remote-smoke",
    "X-Broki-Service-Secret": SMOKE_SECRET,
    "X-Broki-Request-Id": crypto.randomUUID(),
    "X-Broki-Timestamp": Math.floor(Date.now() / 1000).toString(),
  };
}

async function call(
  path: string,
  init: RequestInit = {},
  opts: { skipServiceHeaders?: boolean } = {},
): Promise<{ status: number; body: unknown; text: string }> {
  const headers = new Headers(init.headers);
  if (ANON) {
    headers.set("Authorization", `Bearer ${ANON}`);
    headers.set("apikey", ANON);
  }
  if (!opts.skipServiceHeaders) {
    for (const [k, v] of Object.entries(makeServiceHeaders())) {
      headers.set(k, v);
    }
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
// Cleanup — run on exit or after tests
// ---------------------------------------------------------------------------

let cleanupDone = false;

async function cleanup() {
  if (cleanupDone) return;
  cleanupDone = true;
  if (created.length === 0) return;

  let deleted = 0;
  let remaining = 0;

  for (const item of created) {
    if (item.type === "relay") {
      const r = await call("relays", {
        method: "POST",
        body: JSON.stringify({ action: "delete", id: item.id }),
      });
      if (r.status === 200 || r.status === 404) {
        deleted++;
      } else {
        remaining++;
        console.error(`  cleanup FAIL relay ${item.id}: ${r.status}`);
      }
    }
    if (item.type === "planner_group") {
      const r = await call("planner-action", {
        method: "POST",
        body: JSON.stringify({ action: "delete", group_id: item.id }),
      });
      if (r.status === 200 || r.status === 404) {
        deleted++;
      } else {
        remaining++;
        console.error(`  cleanup FAIL planner group ${item.id}: ${r.status}`);
      }
    }
  }

  console.log(`\nCleanup: Created: ${created.length} / Deleted: ${deleted} / Remaining: ${remaining}`);
  if (remaining > 0) {
    console.error(`  cleanup residues — smoke_run_id: ${SMOKE_RUN_ID}`);
  }
}

// Register cleanup handler for unhandled exits (Deno signal)
try {
  Deno.addSignalListener("SIGINT", () => cleanup().finally(() => Deno.exit(1)));
  Deno.addSignalListener("SIGTERM", () => cleanup().finally(() => Deno.exit(1)));
} catch {
  // Signals may not be available in all environments
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
  // Extraction must not consume the caller's buffer.
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
  const created_ = await call("relays", {
    method: "POST",
    body: JSON.stringify({
      plane: "EC-NFP",
      worker: "Smoke Test",
      points: ["punto uno", "punto dos"],
      metadata: { smoke_run_id: SMOKE_RUN_ID },
    }),
  });
  check(created_.status === 201, "POST relays creates a relay", `got ${created_.status} ${created_.text.slice(0, 160)}`);
  const relay = created_.body as { id?: string; points?: string[] };
  check(relay?.points?.length === 2, "the relay keeps both points");

  if (relay?.id) {
    created.push({ type: "relay", id: relay.id });
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
    // Remove from cleanup list since already deleted
    const idx = created.findIndex((c) => c.type === "relay" && c.id === relay.id);
    if (idx >= 0) created.splice(idx, 1);
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
      id_avion: "EC-SMK",
      modelo: "A330",
      aerolinea: "IBEROJET",
      responsable: "Smoke Test",
      trabajador_1: "Smoke Worker",
      metadata: { smoke_run_id: SMOKE_RUN_ID },
    }),
  });
  check(group.status < 300, "POST planner-action create", `got ${group.status} ${group.text.slice(0, 160)}`);
  const groupId = (group.body as { id?: string })?.id;

  if (groupId) {
    created.push({ type: "planner_group", id: groupId });
  }

  const removed = await call("planner-action", {
    method: "POST",
    body: JSON.stringify({ action: "delete", group_id: groupId }),
  });
  check(removed.status < 300, "POST planner-action delete by group_id", `got ${removed.status}`);
  if (groupId) {
    const idx = created.findIndex((c) => c.type === "planner_group" && c.id === groupId);
    if (idx >= 0) created.splice(idx, 1);
  }

  // Unknown actions must be refused, not silently accepted.
  check(
    (await call("planner-action", { method: "POST", body: JSON.stringify({ action: "nope" }) })).status === 400,
    "planner-action rejects an unknown action with 400",
  );

  // GSE parking must not overwrite ubicacion_habitual.
  type AssetRow = {
    identifier?: string;
    asset_kind?: string;
    parking?: string | null;
    ubicacion_habitual?: string | null;
  };
  const invBefore = await call("inventory-list");
  const rows = Array.isArray(invBefore.body) ? (invBefore.body as AssetRow[]) : [];
  const gseBefore =
    rows.find((r) => r.identifier === "E-07") ??
    rows.find((r) => r.asset_kind !== "van" && r.ubicacion_habitual) ??
    rows.find((r) => r.asset_kind !== "van" && r.identifier);

  if (!gseBefore?.identifier) {
    check(false, "GSE parking test has a target asset", "no GSE row in inventory-list");
  } else {
    const itemId = gseBefore.identifier;
    const usualBefore = gseBefore.ubicacion_habitual ?? "";
    const parkingBefore = gseBefore.parking ?? null;
    const testParking = `SMK-${Date.now().toString().slice(-4)}`;

    const equip = await call("equipment-update", {
      method: "POST",
      body: JSON.stringify({
        item_id: itemId,
        type: "gse",
        updates: { parking: testParking },
      }),
    });
    check(
      equip.status === 200,
      `POST equipment-update updates GSE parking (${itemId})`,
      `got ${equip.status} ${equip.text.slice(0, 160)}`,
    );

    const invAfter = await call("inventory-list");
    const gseAfter = Array.isArray(invAfter.body)
      ? (invAfter.body as AssetRow[]).find((r) => r.identifier === itemId)
      : undefined;
    check(gseAfter?.parking === testParking, "GSE parking persisted", String(gseAfter?.parking));
    check(
      gseAfter?.ubicacion_habitual === usualBefore,
      "GSE ubicacion_habitual unchanged after parking edit",
      `${gseAfter?.ubicacion_habitual} !== ${usualBefore}`,
    );

    await call("equipment-update", {
      method: "POST",
      body: JSON.stringify({
        item_id: itemId,
        type: "gse",
        updates: { parking: parkingBefore },
      }),
    });
  }
}

async function importPhase() {
  console.log("\nPDF imports");

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
    departamento: "Mantenimiento",
    certificaciones: { b1: true },
    numero_bac: `BAC-${unique.slice(0, 4)}`,
    aeronaves: { airbus_a330: { selected: true, b1: true } },
    privacidad: true,
  };

  const first = await call("personnel-register", { method: "POST", body: JSON.stringify(person) });
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
  check(
    typeof (invalid.body as { field?: unknown })?.field === "string",
    "the 400 names the offending field",
    invalid.text.slice(0, 200),
  );
}

// ---------------------------------------------------------------------------
// Auth hardening checks (only when BROKI_REMOTE_TEST_SECRET is set)
// ---------------------------------------------------------------------------

async function authChecks() {
  if (!SMOKE_SECRET) return;
  console.log("\nAuth hardening");

  // No service headers → should get auth error (anon JWT rejected by user-auth)
  {
    const r = await call("inventory-list", {}, { skipServiceHeaders: true });
    check(
      r.status === 401 || r.status === 403,
      "anon-only request to privileged endpoint → 401/403",
      `got ${r.status}`,
    );
  }

  // Wrong secret → 401
  {
    const headers: Record<string, string> = {
      "X-Broki-Service-Id": "remote-smoke",
      "X-Broki-Service-Secret": "wrong-secret-should-fail",
      "X-Broki-Request-Id": crypto.randomUUID(),
      "X-Broki-Timestamp": Math.floor(Date.now() / 1000).toString(),
    };
    const r = await fetch(`${FN}/inventory-list`, {
      headers: {
        Authorization: `Bearer ${ANON}`,
        apikey: ANON,
        ...headers,
      },
    });
    check(r.status === 401, "wrong secret → 401", `got ${r.status}`);
    await r.text();
  }

  // Wrong service id → 403 (valid id but not in allowed list for aircraft-list with n8n)
  // We test with n8n on inventory-list where n8n is not allowed
  {
    const headers: Record<string, string> = {
      "X-Broki-Service-Id": "n8n",
      "X-Broki-Service-Secret": SMOKE_SECRET, // smoke secret ≠ n8n secret, but tests 403 path
      "X-Broki-Request-Id": crypto.randomUUID(),
      "X-Broki-Timestamp": Math.floor(Date.now() / 1000).toString(),
    };
    const r = await fetch(`${FN}/inventory-list`, {
      headers: {
        Authorization: `Bearer ${ANON}`,
        apikey: ANON,
        ...headers,
      },
    });
    // Either 401 (wrong secret for n8n) or 403 (n8n not in allowed list) — both are auth rejections
    check(r.status === 401 || r.status === 403, "n8n not allowed on inventory-list → 401/403", `got ${r.status}`);
    await r.text();
  }

  // Stale timestamp → 401
  {
    const staleTs = (Math.floor(Date.now() / 1000) - 400).toString();
    const headers: Record<string, string> = {
      "X-Broki-Service-Id": "remote-smoke",
      "X-Broki-Service-Secret": SMOKE_SECRET,
      "X-Broki-Request-Id": crypto.randomUUID(),
      "X-Broki-Timestamp": staleTs,
    };
    const r = await fetch(`${FN}/inventory-list`, {
      headers: { Authorization: `Bearer ${ANON}`, apikey: ANON, ...headers },
    });
    check(r.status === 401, "stale timestamp → 401", `got ${r.status}`);
    await r.text();
  }

  // Bad UUID → 400
  {
    const headers: Record<string, string> = {
      "X-Broki-Service-Id": "remote-smoke",
      "X-Broki-Service-Secret": SMOKE_SECRET,
      "X-Broki-Request-Id": "not-a-uuid",
      "X-Broki-Timestamp": Math.floor(Date.now() / 1000).toString(),
    };
    const r = await fetch(`${FN}/inventory-list`, {
      headers: { Authorization: `Bearer ${ANON}`, apikey: ANON, ...headers },
    });
    check(r.status === 400 || r.status === 401, "invalid UUID → 400/401", `got ${r.status}`);
    await r.text();
  }

  // personnel-register (public) must pass without service headers
  {
    const r = await call("personnel-register", {
      method: "POST",
      body: JSON.stringify({ nombre: "", telefono: "123", privacidad: false }),
    }, { skipServiceHeaders: true });
    // Should reach the function (400 = valid call, not 401/403)
    check(r.status === 400, "personnel-register public → reaches handler (400 invalid body)", `got ${r.status}`);
  }
}

// ---------------------------------------------------------------------------

async function n8nPhase() {
  console.log("\nn8n independence");
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
    if (entry.name === "broki-whatsapp-inbound") continue;
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
  await authChecks();
  await cleanup();
} else if (offlineOnly) {
  console.log("\nSkipping live checks: SMOKE_OFFLINE_ONLY=1 (pre-commit).");
} else {
  console.log(`\nSkipping live checks: no Edge Functions at ${FN}.`);
  console.log("Start them with: supabase start && supabase db reset && supabase functions serve");
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) Deno.exit(1);
