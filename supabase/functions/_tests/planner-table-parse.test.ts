// Tests for the tabular planner PDF parser.
//
// Run: deno test -A supabase/functions/_tests/planner-table-parse.test.ts
//
// When a real fixture is available, set:
//   WORKLOAD_FIXTURE_PATH=supabase/functions/_tests/fixtures/real/daily_workload.pdf

import { assertEquals, assertExists } from "jsr:@std/assert";
import { workloadTableLines } from "./fixtures/pdf.ts";
import { parsePlannerTable, parsePlannerText } from "../_shared/planner-parse.ts";

const tableText = workloadTableLines.join("\n");

// ---------------------------------------------------------------------------
// Suite A: New tabular parser (parsePlannerTable)
// All tests in this suite are expected to FAIL until parsePlannerTable exists.
// ---------------------------------------------------------------------------

Deno.test("parsePlannerTable — detects 4 tasks from tabular workload", () => {
  const result = parsePlannerTable(tableText);
  assertEquals(result.tasks.length, 4,
    `Expected 4 tasks (3 EC-NFP + 1 EC-OBM), got ${result.tasks.length}`);
});

Deno.test("parsePlannerTable — Realizado X → estado 1", () => {
  const result = parsePlannerTable(tableText);
  const mel = result.tasks.find((t) => t.codigo === "MEL-2201");
  assertExists(mel, "MEL-2201 task not found");
  assertEquals(mel.estado, 1, "MEL-2201 is marked Realizado=X, expected estado=1");
});

Deno.test("parsePlannerTable — Realizado vacío → estado 0", () => {
  const result = parsePlannerTable(tableText);
  const cdl = result.tasks.find((t) => t.codigo === "CDL-0340");
  assertExists(cdl, "CDL-0340 task not found");
  assertEquals(cdl.estado, 0, "CDL-0340 has no Realizado mark, expected estado=0");
});

Deno.test("parsePlannerTable — notas generales (page 2) produce zero tasks", () => {
  const result = parsePlannerTable(tableText);
  const notas9999 = result.tasks.find((t) => t.codigo === "MEL-9999");
  assertEquals(notas9999, undefined,
    "MEL-9999 is in notas generales and must NOT be imported as a task");
});

Deno.test("parsePlannerTable — A/C column maps to matriculaAvion", () => {
  const result = parsePlannerTable(tableText);
  const obm = result.tasks.find((t) => t.codigo === "SRV-0912");
  assertExists(obm, "SRV-0912 task not found");
  assertEquals(obm.matriculaAvion, "ECOBM",
    "A/C column EC-OBM should normalise to ECOBM");
});

Deno.test("parsePlannerTable — prioridad column maps to NO_GO/CRITICAL/NORMAL", () => {
  const result = parsePlannerTable(tableText);
  const mel = result.tasks.find((t) => t.codigo === "MEL-2201");
  const cdl = result.tasks.find((t) => t.codigo === "CDL-0340");
  assertExists(mel); assertExists(cdl);
  assertEquals(mel.prioridad, "NO_GO");
  assertEquals(cdl.prioridad, "CRITICAL");
});

Deno.test("parsePlannerTable — tipo_tarea column extracted", () => {
  const result = parsePlannerTable(tableText);
  const mel = result.tasks.find((t) => t.codigo === "MEL-2201");
  assertExists(mel);
  assertEquals(mel.tipoTarea, "MEL");
});

// ---------------------------------------------------------------------------
// Suite B: Fallback to legacy parsePlannerText when no table header found
// These tests pass with the CURRENT parser.
// ---------------------------------------------------------------------------

Deno.test("parsePlannerText (legacy) — still parses non-tabular format", () => {
  const legacy = [
    "HOJA DE TRABAJO EC-NFP 2026-08-01",
    "MEL-2201 NO-GO Revisar luz de posicion",
    "SRV-0912 NORMAL Carga nitrogeno",
  ].join("\n");
  const result = parsePlannerText(legacy);
  assertEquals(result.tasks.length, 2,
    `Legacy parser should still yield 2 tasks, got ${result.tasks.length}`);
  assertEquals(result.tasks[0].estado, 0,
    "Legacy parser always sets estado=0 (known limitation)");
});

// ---------------------------------------------------------------------------
// Suite C: Real fixture (optional, skipped when env var absent)
// ---------------------------------------------------------------------------

const realPath = Deno.env.get("WORKLOAD_FIXTURE_PATH");

Deno.test({
  name: "parsePlannerTable — real fixture yields >0 tasks and imports Realizado",
  ignore: !realPath,
  fn: async () => {
    assertExists(realPath);
    const bytes = await Deno.readFile(realPath);
    // Import extractPdfText dynamically to keep test runnable offline.
    const { extractPdfText } = await import("../_shared/pdf.ts");
    const pdf = await extractPdfText(bytes);
    const result = parsePlannerTable(pdf.text);
    assertEquals(result.tasks.length > 0, true, "Real fixture must produce at least 1 task");
    const done = result.tasks.filter((t) => t.estado === 1);
    assertEquals(done.length > 0, true,
      "Real fixture must import at least 1 completed task (Realizado)");
  },
});
