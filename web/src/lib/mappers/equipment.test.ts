import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeGSE } from "./equipment.ts";

describe("normalizeGSE", () => {
  it("keeps parking and ubicacion_habitual separate", () => {
    const item = normalizeGSE({
      identifier: "E-07",
      descripcion: "Escalera",
      parking: "305",
      ubicacion_habitual: "T4",
      estado: "Disponible",
    });

    assert.equal(item.parking, "305");
    assert.equal(item.usualLocation, "T4");
    assert.equal(item.location, "T4");
  });

  it("does not fall back parking into usualLocation", () => {
    const item = normalizeGSE({
      identifier: "GPU-01",
      descripcion: "GPU",
      parking: "542",
      estado: "Disponible",
    });

    assert.equal(item.parking, "542");
    assert.equal(item.usualLocation, "");
    assert.equal(item.location, "");
  });
});
