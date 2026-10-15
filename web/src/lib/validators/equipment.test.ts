import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateEquipmentFields, EQUIPMENT_STATUSES } from "./equipment.ts";

const base = {
  parking: "",
  usualLocation: "",
  plane: "",
  worker: "",
  fuel: "",
  adblue: "",
  status: "Disponible",
  notes: "",
  botella_1: "",
  botella_2: "",
  botella_3: "",
  botella_4: "",
};

describe("validateEquipmentFields", () => {
  it("accepts a plain valid form", () => {
    assert.deepEqual(validateEquipmentFields(base, { isFurgo: true, isNitrogen: false }), {});
  });
  it("requires a status", () => {
    const e = validateEquipmentFields({ ...base, status: " " }, { isFurgo: false, isNitrogen: false });
    assert.ok(e.status);
  });
  it("rejects fuel outside 0-100 and reports the field", () => {
    const e = validateEquipmentFields({ ...base, fuel: "140" }, { isFurgo: true, isNitrogen: false });
    assert.match(e.fuel ?? "", /0 y 100/);
    assert.equal(e.adblue, undefined);
  });
  it("rejects negative or absurd PSI", () => {
    const e = validateEquipmentFields({ ...base, botella_2: "-5", botella_3: "9000" }, { isFurgo: false, isNitrogen: true });
    assert.ok(e.botella_2 && e.botella_3 && !e.botella_1);
  });
  it("exposes the canonical status list", () => {
    assert.ok(EQUIPMENT_STATUSES.includes("Inoperativo"));
  });
});
