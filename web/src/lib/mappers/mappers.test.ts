// Run with: npm test  (node --test, native TypeScript type stripping)
//
// These pin the classification rules ported from the legacy broki.html. They are
// order-sensitive: "EN USO" contains the substring "US", which also appears in
// the inoperative list, so a reordering would silently reclassify vans in use.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  getFamily,
  getStatusCategory,
  normalizeFurgo,
  normalizeGSE,
  normalizePersonnel,
  splitInventory,
  toNumber,
} from "./equipment.ts";
import { mergePlannerData } from "./planner.ts";

test("toNumber falls back instead of producing NaN", () => {
  assert.equal(toNumber("82"), 82);
  assert.equal(toNumber("82%"), 82);
  assert.equal(toNumber("82,5"), 82.5);
  assert.equal(toNumber(""), 0);
  assert.equal(toNumber(null), 0);
  assert.equal(toNumber(undefined, 100), 100);
  assert.equal(toNumber("no", 100), 100);
  assert.equal(toNumber(0, 100), 0, "a real zero must not fall back");
});

test("getFamily classifies by description then by id prefix", () => {
  const gse = (model: string, id = "X-1") => getFamily({ model, id, type: "gse" });

  assert.equal(gse("Carro Nitrogeno"), "Nitrógeno");
  assert.equal(gse("Carro Nitrógeno"), "Nitrógeno", "accented spelling");
  assert.equal(gse("Botella Oxigeno"), "Oxígeno");
  assert.equal(gse("Escalera Pasajeros"), "Escaleras");
  assert.equal(gse("Plataforma elevadora"), "Plataformas");
  assert.equal(gse("Gato hidraulico"), "Gatos Hidráulicos");
  assert.equal(gse("Hydramite 20T"), "Gatos Hidráulicos");
  assert.equal(gse("GPU Generador"), "GPUs y Generadores");
  assert.equal(gse("Compresor aire"), "Compresores");
  assert.equal(gse("Tarjeta combustible"), "Tarjetas");

  // Falls through to the id prefix when the description says nothing.
  assert.equal(gse("", "E-07"), "Escaleras");
  assert.equal(gse("", "P-12"), "Plataformas");
  assert.equal(gse("", "G-3"), "Vehículos");
  assert.equal(gse("Equipo sin clasificar", "Z-9"), "Otros Equipos");

  // A van is a vehicle even when its description does not say so.
  assert.equal(getFamily({ model: "Renault Master", id: "FURGO-01", type: "furgo" }), "Vehículos");
});

test("getStatusCategory buckets every keyword despite overlapping substrings", () => {
  assert.equal(getStatusCategory("Disponible"), "available");
  assert.equal(getStatusCategory("OPERATIVO"), "available");
  assert.equal(getStatusCategory("Libre"), "available");

  assert.equal(getStatusCategory("En Uso"), "occupied");
  assert.equal(getStatusCategory("Ocupado"), "occupied");

  // "INOPERATIVO" contains "OPERATIVO" and "USO" contains "US"; both used to be
  // misclassified. An inoperative unit painted green is a safety problem.
  assert.equal(getStatusCategory("Inoperativo"), "inoperative");
  assert.equal(getStatusCategory("En Mantenimiento"), "inoperative");
  assert.equal(getStatusCategory("U.S."), "inoperative");
  assert.equal(getStatusCategory("Averiado"), "inoperative");

  assert.equal(getStatusCategory(""), "unknown");
  assert.equal(getStatusCategory("Vete a saber"), "unknown");
});

test("normalizeFurgo applies the legacy defaults", () => {
  const furgo = normalizeFurgo({
    identificador: "furgo-02",
    vehiculo: "Furgoneta Linea",
    plazas: "3",
    matricula: "5678-def",
    parking: "520",
    avion: "ec-nfp",
    combustible: "18",
    trabajadores: "Mario Lorenzo",
    estado: "En Uso",
  });

  // uc() only trims, as in legacy; casing is normalized where it is compared.
  assert.equal(furgo.id, "furgo-02");
  assert.equal(furgo.type, "furgo");
  assert.equal(furgo.family, "Vehículos");
  assert.equal(furgo.seats, 3);
  assert.equal(furgo.location, "520");
  assert.equal(furgo.fuel, 18);

  // Missing parking becomes BASE and missing fuel becomes 100, matching legacy.
  const bare = normalizeFurgo({ identificador: "furgo-01" });
  assert.equal(bare.location, "BASE");
  assert.equal(bare.fuel, 100);
  assert.equal(bare.status, "Disponible");
});

test("normalizeGSE fills nitrogen pressures only for nitrogen carts", () => {
  const nitro = normalizeGSE({
    identificador: "N2-01",
    descripcion: "Carro Nitrogeno",
    ubicacion_habitual: "T4S",
    parking: "542",
    nitrogeno_1: "2400",
    nitrogeno_2: "1900",
    nitrogeno_3: "700",
    nitrogeno_4: "0",
    estado: "En Uso",
  });

  assert.equal(nitro.family, "Nitrógeno");
  assert.deepEqual(nitro.pressures, [2400, 1900, 700, 0]);
  assert.equal(nitro.location, "T4S", "location comes from ubicacion_habitual");
  assert.equal(nitro.parking, "542", "parking stays a separate field for GSE");

  const gpu = normalizeGSE({ identificador: "GPU-01", descripcion: "GPU Generador" });
  assert.deepEqual(gpu.pressures, [], "non-nitrogen GSE has no pressures");
});

test("splitInventory routes rows by familia", () => {
  const { furgonetas, gse } = splitInventory([
    { identificador: "FURGO-01", familia: "FURGONETA" },
    { identificador: "V-02", familia: "VEHICULO" },
    { identificador: "N2-01", familia: "NITROGENO", descripcion: "Carro Nitrogeno" },
    { identificador: "E-07", familia: "GSE" },
  ]);

  assert.deepEqual(furgonetas.map((f) => f.id), ["FURGO-01", "V-02"]);
  assert.deepEqual(gse.map((g) => g.id), ["N2-01", "E-07"]);
});

test("normalizePersonnel strips accents and expands per-aircraft ratings", () => {
  const person = normalizePersonnel({
    nombre: "Enrique García",
    b1: true,
    b1_airbus_a330: 1,
    a_a320_family: 1,
    n_bac: "BAC-265",
    b2: false,
  });

  assert.equal(person.name, "Enrique Garcia", "accents removed for search parity");
  assert.ok(person.qualifications.includes("B1"));
  assert.ok(person.qualifications.includes("BAC-265"));
  assert.ok(person.qualifications.includes("B1 A330"));
  assert.ok(person.qualifications.includes("A A320"));
  assert.ok(!person.qualifications.includes("B2"), "false flags are not listed");
  assert.equal(
    person.qualifications.length,
    new Set(person.qualifications).size,
    "qualifications are deduplicated",
  );
});

test("mergePlannerData keeps today's groups and attaches their tasks", () => {
  const today = new Date().toISOString();
  const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString();

  const groups = mergePlannerData(
    [
      { id: 1, id_avion: "EC-NFP", fecha_modificacion: today, vehiculo: "FURGO-02", responsable: "Mario" },
      { id: 2, id_avion: "EC-OBM", fecha_modificacion: lastWeek },
      { id: 3, id_avion: "", fecha_modificacion: today },
    ],
    [
      { id: 10, matricula_avion: "ec-nfp", codigo: "MEL-2201", fecha: today, estado: 0, prioridad: "NO_GO" },
      { id: 11, matricula_avion: "EC-NFP", codigo: "MEL-2201", fecha: today, estado: 1 },
      { id: 12, matricula_avion: "EC-NFP", codigo: "OLD-1", fecha: lastWeek, estado: 0 },
      { id: 13, matricula_avion: "EC-OBM", codigo: "OTHER-1", fecha: today, estado: 0 },
    ],
  );

  assert.equal(groups.length, 1, "stale groups and groups without a registration are dropped");

  const group = groups[0];
  assert.equal(group.matricula, "EC-NFP");
  assert.equal(group.furgo, "FURGO-02");
  assert.equal(group.tasks.length, 1, "the same code twice collapses into one task");
  assert.equal(group.tasks[0].code, "MEL-2201");
  assert.equal(group.tasks[0].done, true, "the later row wins, estado 1 means done");
  assert.equal(group.tasks[0].priority, "NORMAL", "missing priority defaults to NORMAL");
});

test("mergePlannerData reads workers from members or from trabajador_N", () => {
  const today = new Date().toISOString();

  const [fromMembers] = mergePlannerData(
    [{
      id: 1,
      id_avion: "EC-NFP",
      fecha_modificacion: today,
      members: [{ worker_text: "Mario" }, { worker_text: "Enrique" }, { worker_text: "" }],
    }],
    [],
  );
  assert.deepEqual(fromMembers.workers, ["Mario", "Enrique"]);

  const [fromColumns] = mergePlannerData(
    [{ id: 1, id_avion: "EC-NFP", fecha_modificacion: today, trabajador_1: "Mario", trabajador_3: "Ana" }],
    [],
  );
  assert.deepEqual(fromColumns.workers, ["Mario", "Ana"]);
});

test("mergePlannerData tolerates non-array input", () => {
  // The Edge Functions can return an error object instead of a list.
  assert.deepEqual(mergePlannerData(undefined as never, []), []);
  assert.deepEqual(mergePlannerData([], undefined as never), []);
});
