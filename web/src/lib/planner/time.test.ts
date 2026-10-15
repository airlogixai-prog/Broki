import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { combineDayAndTime, arrivalPayload } from "./time.ts";

describe("planner time helpers", () => {
  it("combines the board day with a wall-clock time into an ISO timestamp", () => {
    const iso = combineDayAndTime("2026-10-14", "10:05")!;
    const d = new Date(iso);
    assert.equal(d.getHours(), 10);
    assert.equal(d.getMinutes(), 5);
    assert.equal(d.getDate(), 14);
  });

  it("rejects values that are not HH:MM", () => {
    assert.equal(combineDayAndTime("2026-10-14", "BASE"), null);
    assert.equal(combineDayAndTime("2026-10-14", ""), null);
  });

  it("maps BASE/PRE to destino and leaves the arrival time empty", () => {
    assert.deepEqual(arrivalPayload("2026-10-14", "base"), { hora_llegada: null, destino: "BASE" });
    assert.deepEqual(arrivalPayload("2026-10-14", ""), { hora_llegada: null, destino: null });
    assert.ok(arrivalPayload("2026-10-14", "12:30").hora_llegada?.endsWith("Z"));
  });
});
