/**
 * Pipeline P0: DB/EF shape → mapper → UI view fields.
 * Proves canonical columns are not dropped into raw_payload-only hell.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAircraft,
  normalizeFurgo,
  normalizeGSE,
} from "./equipment.ts";
import { normalizeToolingCatalog } from "./tooling.ts";
import type { AircraftRow, AssetRow, ToolingCatalogRow } from "../api/canonical.ts";

function assetFixture(over: Partial<AssetRow> & { identifier: string }): AssetRow {
  return {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    external_id: "7",
    source_system: "n8n_postgres_pro",
    source_table: "pro.furgonetas",
    asset_kind: "van",
    descripcion: null,
    nombre_equipo: null,
    matricula: null,
    familia: null,
    plazas: null,
    estado: "Disponible",
    ubicacion_habitual: "T4",
    parking: "305",
    avion_text: "EC-NGY",
    aircraft_id: null,
    current_worker_text: "Jose Luis Alvaro Granado",
    current_worker_id: "11111111-2222-3333-4444-555555555555",
    combustible: 80,
    adblue: 40,
    nitrogeno_1: null,
    nitrogeno_2: null,
    nitrogeno_3: null,
    nitrogeno_4: null,
    notas: null,
    ...over,
  };
}

test("P0 furgo: worker + vehiculo + ubicacion survive EF→mapper→UI fields", () => {
  const ef = {
    ...assetFixture({
      identifier: "G4-6",
      descripcion: null,
      current_worker_text: "Ana Perez",
      current_worker_id: "aaaaaaaa-0000-0000-0000-000000000001",
      ubicacion_habitual: "BASE",
    }),
    vehiculo: "Furgoneta Mercedes",
  };
  const ui = normalizeFurgo(ef);
  assert.equal(ui.id, "G4-6", "identifier/BRK-style id");
  assert.equal(ui.model, "Furgoneta Mercedes", "vehiculo → model when descripcion empty");
  assert.equal(ui.worker, "Ana Perez", "current_worker_text → worker");
  assert.equal(ui.workerId, "aaaaaaaa-0000-0000-0000-000000000001");
  assert.equal(ui.usualLocation, "BASE");
  assert.equal(ui.dbId, ef.id);
});

test("P0 gse: BRK identifier + worker not raw-only", () => {
  const ef = assetFixture({
    identifier: "BRK-005",
    asset_kind: "gse",
    source_table: "pro.gse",
    descripcion: "GPU 90kVA",
    current_worker_text: "Steven Villavicencio",
    ubicacion_habitual: "T1S",
  });
  const ui = normalizeGSE(ef);
  assert.equal(ui.id, "BRK-005");
  assert.equal(ui.model, "GPU 90kVA");
  assert.equal(ui.worker, "Steven Villavicencio");
  assert.equal(ui.usualLocation, "T1S");
});

test("P0 aircraft: aerolinea + msn + motor", () => {
  const ef: AircraftRow = {
    id: "ac-1",
    matricula: "EC-NGY",
    modelo: "A320",
    aerolinea: "Iberia",
    msn: "1234",
    motor: "CFM56",
    estado: "OK",
  };
  const ui = normalizeAircraft(ef);
  assert.equal(ui.reg, "EC-NGY");
  assert.equal(ui.airline, "Iberia");
  assert.equal(ui.msn, "1234");
  assert.equal(ui.motor, "CFM56");
});

test("P0 tooling: tipo/supplier/manufacturer/part/serial/ubicacion from canonical cols", () => {
  const ef: ToolingCatalogRow = {
    id: "t1",
    bac_bact: "BAC-100",
    codigo: "PN-9",
    descripcion: "Torque wrench",
    familia: "IGNORED_WHEN_TIPO",
    estado: "OK",
    tipo: "herramienta",
    supplier: "Snap-on",
    manufacturer: "CDI",
    part_number: "PN-CANON",
    serial_number: "SN-77",
    ubicacion_habitual: "Armario A",
    raw_payload: {
      tipo: "RAW_MUST_NOT_WIN",
      supplier: "RAW",
      ubicacion_habitual: "RAW_LOC",
      part_number: "RAW_PN",
      serial_number: "RAW_SN",
    },
  };
  const ui = normalizeToolingCatalog(ef);
  assert.equal(ui.tipo, "herramienta", "canonical tipo wins over familia/raw");
  assert.equal(ui.supplier, "Snap-on");
  assert.equal(ui.manufacturer, "CDI");
  assert.equal(ui.partNumber, "PN-CANON");
  assert.equal(ui.serialNumber, "SN-77");
  assert.equal(ui.ubicacion, "Armario A");
  assert.notEqual(ui.ubicacion, "RAW_LOC");
});

test("P0 tooling: familia fallback only when tipo null", () => {
  const ui = normalizeToolingCatalog({
    id: "t2",
    bac_bact: "BAC-2",
    codigo: null,
    descripcion: "x",
    familia: "metrologia",
    estado: null,
    tipo: null,
    supplier: null,
    manufacturer: null,
    part_number: null,
    serial_number: null,
    ubicacion_habitual: null,
  });
  assert.equal(ui.tipo, "metrologia");
});
