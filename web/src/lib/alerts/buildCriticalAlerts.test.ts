import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCriticalAlerts } from "./buildCriticalAlerts.ts";
import type { Equipment } from "../types/equipment.ts";

const base = (over: Partial<Equipment>): Equipment => ({
  id: "X",
  type: "gse",
  family: "",
  model: "",
  plate: "",
  location: "",
  usualLocation: "",
  parking: "",
  plane: "",
  worker: "",
  notes: "",
  status: "Disponible",
  fuel: null,
  pressures: [],
  ...over,
});

describe("buildCriticalAlerts", () => {
  it("lists inoperative equipment individually up to the legacy threshold", () => {
    const gse = ["A", "B", "C"].map((id) => base({ id, status: "Inoperativo" }));
    const alerts = buildCriticalAlerts([], gse, {});
    assert.deepEqual(alerts.map((a) => a.id).sort(), ["inoperative-A", "inoperative-B", "inoperative-C"]);
  });

  it("summarises more than three inoperative units in one alert", () => {
    const gse = ["A", "B", "C", "D"].map((id) => base({ id, status: "Inoperativo" }));
    const alerts = buildCriticalAlerts([], gse, {});
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].id, "inoperative-summary");
    assert.match(alerts[0].message, /A, B, C, D/);
  });

  it("does not double-report an inoperative unit that already has an open incident", () => {
    const gse = [base({ id: "A", status: "Inoperativo" })];
    const alerts = buildCriticalAlerts([], gse, {
      A: { current: { id: "i-A-1", openedAt: "", messages: [{ user: "u", text: "fuga", time: "" }] }, history: [] },
    });
    assert.deepEqual(alerts.map((a) => a.type), ["incident"]);
  });

  it("flags nitrogen bottles with 0 < PSI < 500 and ignores empty bottles", () => {
    const n2 = base({ id: "N2-01", model: "Carro Nitrogeno", pressures: [2400, 300, 0, 450] });
    const alerts = buildCriticalAlerts([], [n2], {});
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].type, "nitrogen");
    assert.match(alerts[0].message, /2 botellas/);
  });

  it("fuel alert applies to vans and GPUs but not to a stair", () => {
    const furgo = base({ id: "F1", type: "furgo", fuel: 10 });
    const stair = base({ id: "E-1", model: "Escalera", fuel: 10 });
    const gpu = base({ id: "GPU-1", model: "GPU Generador", fuel: 20 });
    const alerts = buildCriticalAlerts([furgo], [stair, gpu], {});
    assert.deepEqual(alerts.map((a) => a.id).sort(), ["fuel-F1", "fuel-GPU-1"]);
  });

  it("sorts critical before high", () => {
    const furgo = base({ id: "F1", type: "furgo", fuel: 10 });
    const alerts = buildCriticalAlerts([furgo], [], {}, { temp: -2, qnh: 1013, wind: { dir: 0, speed: 0 }, raw: "" });
    assert.deepEqual(alerts.map((a) => a.priority), ["critical", "high"]);
  });
});
