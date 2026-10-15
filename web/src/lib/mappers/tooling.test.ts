import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeToolingCatalog, normalizeToolingMovement, toolAvailability } from "./tooling.ts";

describe("tooling mappers", () => {
  const tool = normalizeToolingCatalog({
    id: "1", bac_bact: "BAC-1001", codigo: "PN-1", descripcion: "Llave", familia: "BAC", estado: "SERVICEABLE",
    tipo: null, supplier: "ACME", manufacturer: null, part_number: null, serial_number: "SN-1", ubicacion_habitual: "Taller",
  });

  it("maps canonical columns and falls back to familia/codigo", () => {
    assert.equal(tool.tipo, "BAC");
    assert.equal(tool.partNumber, "PN-1");
    assert.equal(tool.serialNumber, "SN-1");
  });

  it("derives availability from estado and open movement", () => {
    assert.equal(toolAvailability(tool, false), "available");
    assert.equal(toolAvailability(tool, true), "checked_out");
    assert.equal(toolAvailability({ ...tool, estado: "U/S" }, false), "unserviceable");
    assert.equal(toolAvailability({ ...tool, estado: "U/S" }, true), "unserviceable");
    assert.equal(toolAvailability({ ...tool, estado: "Revisión" }, false), "unknown");
  });

  it("maps movement condition fields", () => {
    const m = normalizeToolingMovement({
      id: "m1", tool_id: "1", bac_bact: "BAC-1001", descripcion: "Llave", tma_out: "Mario", tma_out_person_id: null,
      complete_out: "Completo", date_out: "2026-01-01T00:00:00Z", tma_in: "Ana", tma_in_person_id: null, complete_in: "Defectuoso",
      date_in: "2026-01-02T00:00:00Z", remarks: null, avion: "EC-NFP", aircraft_id: null,
    });
    assert.equal(m.status, "returned");
    assert.equal(m.checkoutCondition, "Completo");
    assert.equal(m.checkinCondition, "Defectuoso");
  });
});
