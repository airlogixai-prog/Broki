import { test } from "node:test";
import assert from "node:assert/strict";
import { computeFleetKpis, isFuelCritical, nitrogenReadings, splitIssues, usesFuel } from "./kpis.ts";
import type { Equipment, IncidentState } from "../types/equipment.ts";

const eq = (over: Partial<Equipment>): Equipment => ({
  id: "X", type: "gse", family: "", model: "", plate: "", location: "", usualLocation: "", parking: "",
  plane: "", worker: "", notes: "", status: "Disponible", fuel: null, pressures: [], ...over,
});
const inc = (id: string): Record<string, IncidentState> => ({
  [id]: { current: { id: "i-1", openedAt: "2026-01-01", messages: [] }, history: [] },
});

test("kpis: operative = available + occupied; issues = inoperative ∪ open incident; health uses issues", () => {
  const items = [
    eq({ id: "A", status: "Disponible" }),
    eq({ id: "B", status: "En Uso" }),
    eq({ id: "C", status: "Inoperativo" }),
    eq({ id: "D", status: "Disponible" }),
    eq({ id: "E", status: "" }),
  ];
  const k = computeFleetKpis(items, inc("D"));
  assert.equal(k.total, 5);
  assert.equal(k.available, 2);
  assert.equal(k.unknown, 1);
  assert.equal(k.operative, 3);
  assert.equal(k.withIssues, 2);
  assert.equal(k.openIncidents, 1);
  assert.equal(k.healthPct, 60);
  assert.equal(k.pct(3), 60);
});

test("kpis: empty fleet has zero denominators without NaN", () => {
  const k = computeFleetKpis([], {});
  assert.equal(k.healthPct, 0);
  assert.equal(k.pct(0), 0);
});

test("fuel: null reading is never critical; vans and GPUs count, scissors don't", () => {
  assert.equal(isFuelCritical(eq({ type: "furgo", fuel: null })), false);
  assert.equal(isFuelCritical(eq({ type: "furgo", fuel: 10 })), true);
  assert.equal(isFuelCritical(eq({ type: "gse", model: "GPU 90KVA", fuel: 20 })), true);
  assert.equal(isFuelCritical(eq({ type: "gse", model: "Escalera", fuel: 5 })), false);
  assert.equal(usesFuel(eq({ type: "gse", model: "PLATAFORMA MOTORIZADA" })), true);
});

test("nitrogen: explicit bottle fields win, nulls are unknown not zero", () => {
  assert.deepEqual(nitrogenReadings(eq({ botella_1: 2000, botella_2: null, pressures: [1, 2, 3, 4] })), [2000]);
  assert.deepEqual(nitrogenReadings(eq({ pressures: [100, 200] })), [100, 200]);
});

test("splitIssues separates open incidents from inoperative-only", () => {
  const items = [eq({ id: "A", status: "Inoperativo" }), eq({ id: "B", status: "Disponible" }), eq({ id: "C", status: "Inoperativo" })];
  const s = splitIssues(items, inc("C"));
  assert.deepEqual(s.withOpenIncident.map((i) => i.id), ["C"]);
  assert.deepEqual(s.inoperativeOnly.map((i) => i.id), ["A"]);
  assert.equal(s.total, 2);
});
