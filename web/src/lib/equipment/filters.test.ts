import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { equipmentSearchText, filterEquipment } from "./filters.ts";
import type { Equipment } from "../types/equipment.ts";

const sample: Equipment = {
  id: "F-01",
  type: "furgo",
  family: "Vehículos",
  model: "Sprinter",
  plate: "1234-ABC",
  location: "BASE",
  usualLocation: "T4",
  parking: "P-320",
  plane: "EC-NFP",
  fuel: 40,
  adblue: 80,
  worker: "Mario Lorenzo",
  notes: "Revisar",
  status: "En Uso",
  pressures: [],
};

describe("equipment filters", () => {
  it("matches worker and parking in search", () => {
    assert.ok(equipmentSearchText(sample).includes("mario"));
    assert.ok(equipmentSearchText(sample).includes("p-320"));
  });

  it("filters by avion and family", () => {
    const out = filterEquipment([sample], {
      filter: "",
      statusFilter: "all",
      avionFilter: "EC-NFP",
      familyFilter: "Vehículos",
    });
    assert.equal(out.length, 1);
  });

  it("filters by issues status", () => {
    const inop = { ...sample, status: "INOPERATIVO" };
    const out = filterEquipment([inop], {
      filter: "",
      statusFilter: "issues",
      avionFilter: "all",
      familyFilter: "all",
    });
    assert.equal(out.length, 1);
  });
});

describe("issues filter with incidents", () => {
  it("includes equipment with an open incident even if its status is available", () => {
    const out = filterEquipment([sample], {
      filter: "",
      statusFilter: "issues",
      avionFilter: "all",
      familyFilter: "all",
      incidents: { "F-01": { current: { id: "i", openedAt: "", messages: [] }, history: [] } },
    });
    assert.equal(out.length, 1);
  });
});
