/**
 * Fase 10.3 — fixtures with EXACT legacy aliases.
 */
import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertNoConceptMix,
  mapAircraft,
  mapAssetDescripcion,
  mapAssetIdentifier,
  mapAssetWorker,
  mapNitroBottles,
  mapTooling,
} from "../_shared/legacy-field-normalize.ts";

Deno.test("furgonetas.trabajadores → current_worker_text", () => {
  assertEquals(
    mapAssetWorker({ trabajadores: "Carlos Pérez", estado: "OK" }),
    "Carlos Pérez",
  );
  assertEquals(mapAssetWorker({ TRABAJADORES: "Luis" }), "Luis");
});

Deno.test("gse.trabajadores alias", () => {
  assertEquals(mapAssetWorker({ trabajadores: "Equipo A" }), "Equipo A");
  assertEquals(mapAssetWorker({ trabajador: "Solo" }), "Solo");
});

Deno.test("gse.brk → identifier (before bare id)", () => {
  assertEquals(
    mapAssetIdentifier({ brk: "BRK-042", id: "99" }, "99"),
    "BRK-042",
  );
  assertEquals(
    mapAssetIdentifier({ identificador: "G4-6", brk: "BRK-X" }, "1"),
    "G4-6",
  );
});

Deno.test("aviones.compania → aerolinea", () => {
  assertEquals(
    mapAircraft({ compania: "Vueling", matricula: "EC-NGY" }).aerolinea,
    "Vueling",
  );
  assertEquals(
    mapAircraft({ aerolinea: "Iberia", compania: "Ignore" }).aerolinea,
    "Iberia",
  );
});

Deno.test("furgonetas.vehiculo → descripcion fallback", () => {
  assertEquals(mapAssetDescripcion({ vehiculo: "Ford Transit" }), "Ford Transit");
  assertEquals(
    mapAssetDescripcion({ descripcion: "Van", vehiculo: "Transit" }),
    "Van",
  );
});

Deno.test("tooling.tipo / supplier / manufacturer", () => {
  const m = mapTooling({
    tipo: "Calibración",
    supplier: "RS",
    manufacturer: "Snap-on",
    identificador: "BAC1001",
  });
  assertEquals(m.tipo, "Calibración");
  assertEquals(m.supplier, "RS");
  assertEquals(m.manufacturer, "Snap-on");
  assertEquals(m.bac_bact, "BAC1001");
});

Deno.test("nitro typo histórico cantida_de_botellas_llenas", () => {
  assertEquals(
    mapNitroBottles({
      cantida_de_botellas_llenas: "4",
      cantidad_de_botellas_vacias: "2",
    }),
    { botellas_llenas: 4, botellas_vacias: 2 },
  );
});

Deno.test("msn ≠ matricula; motor ≠ modelo", () => {
  const row = {
    matricula: "EC-AAA",
    msn: "MSN-999",
    modelo: "A320",
    motor: "CFM56",
    compania: "TestAir",
  };
  const m = mapAircraft(row);
  assertEquals(m.matricula, "EC-AAA");
  assertEquals(m.msn, "MSN-999");
  assertEquals(m.modelo, "A320");
  assertEquals(m.motor, "CFM56");
  assert(assertNoConceptMix(row));
});
