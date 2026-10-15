import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rowsToLocations, validateCounts, locationLabel } from "./nitro.ts";

describe("nitro stock mapping", () => {
  it("keeps one location per ubicacion and never sums duplicate rows", () => {
    const locs = rowsToLocations([
      { id: "1", ubicacion: "t4s", botellas_llenas: 14, botellas_vacias: 6 },
      { id: "2", ubicacion: "T4S", botellas_llenas: 2, botellas_vacias: 1, updated_at: "2026-01-02T00:00:00Z" },
      { id: "3", ubicacion: "t1,2,3", botellas_llenas: 9, botellas_vacias: 11 },
      { id: "4", ubicacion: "", botellas_llenas: 99, botellas_vacias: 99 },
    ]);
    assert.deepEqual(locs.map((l) => l.key), ["t1,2,3", "t4s"]);
    const t4s = locs.find((l) => l.key === "t4s")!;
    assert.equal(t4s.full, 2, "newest row wins, counts are not added up");
  });

  it("reads legacy typo aliases", () => {
    const [loc] = rowsToLocations([{ id: "1", ubicacion: "t4", botellas_llenas: null, botellas_vacias: null, cantida_de_botellas_llenas: "7", cantidad_de_botellas_vacias: "3" }]);
    assert.equal(loc.full, 7);
    assert.equal(loc.empty, 3);
  });

  it("labels locations", () => {
    assert.equal(locationLabel("t1,2,3"), "T1, T2, T3");
    assert.equal(locationLabel("t4s"), "T4S");
  });

  it("validates integer counts", () => {
    assert.deepEqual(validateCounts({ full: "3", empty: "0" }), {});
    assert.ok(validateCounts({ full: "-1", empty: "2.5" }).full);
    assert.ok(validateCounts({ full: "1", empty: "" }).empty);
  });
});
