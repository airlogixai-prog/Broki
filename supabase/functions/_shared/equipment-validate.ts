/** Trust-boundary validation for equipment-update payloads. */

export class EquipmentValidationError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "EquipmentValidationError";
  }
}

const MAX_TEXT = 500;
const MAX_STATUS = 100;

function assertPresent(key: string, updates: Record<string, unknown>) {
  return Object.prototype.hasOwnProperty.call(updates, key);
}

function assertText(value: unknown, field: string, max = MAX_TEXT) {
  if (value === null || value === undefined) return;
  const s = String(value);
  if (s.length > max) {
    throw new EquipmentValidationError(`${field} demasiado largo (max ${max})`, field);
  }
}

function assertPercent(value: unknown, field: string) {
  if (value === null || value === "") return;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new EquipmentValidationError(`${field} debe estar entre 0 y 100`, field);
  }
}

function assertPsi(value: unknown, field: string) {
  if (value === null || value === "") return;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new EquipmentValidationError(`${field} debe ser un numero finito >= 0`, field);
  }
}

export function validateEquipmentUpdates(
  updates: Record<string, unknown>,
  _type: string,
): void {
  if (assertPresent("fuel", updates)) assertPercent(updates.fuel, "fuel");
  if (assertPresent("adblue", updates)) assertPercent(updates.adblue, "adblue");
  for (const n of ["nitrogeno_1", "nitrogeno_2", "nitrogeno_3", "nitrogeno_4"] as const) {
    if (assertPresent(n, updates)) assertPsi(updates[n], n);
  }

  if (assertPresent("status", updates)) assertText(updates.status, "status", MAX_STATUS);
  if (assertPresent("plane", updates)) assertText(updates.plane, "plane");
  if (assertPresent("worker", updates)) assertText(updates.worker, "worker");
  if (assertPresent("notes", updates)) assertText(updates.notes, "notes", 2000);
  if (assertPresent("parking", updates)) assertText(updates.parking, "parking");
  if (assertPresent("location", updates)) assertText(updates.location, "location");
  if (assertPresent("usual_location", updates)) assertText(updates.usual_location, "usual_location");
  if (assertPresent("matricula", updates)) assertText(updates.matricula, "matricula", 32);
  if (assertPresent("descripcion", updates)) assertText(updates.descripcion, "descripcion", 500);
  if (assertPresent("plazas", updates)) {
    const n = Number(updates.plazas);
    if (!Number.isInteger(n) || n < 0 || n > 99) {
      throw new EquipmentValidationError("plazas debe ser un entero entre 0 y 99", "plazas");
    }
  }
}

if (import.meta.main) {
  const assert = (fn: () => void, msg: string) => {
    try {
      fn();
    } catch {
      return;
    }
    throw new Error(`FAIL: expected throw for ${msg}`);
  };
  const ok = (fn: () => void) => fn();

  ok(() => validateEquipmentUpdates({ fuel: 50 }, "furgo"));
  ok(() => validateEquipmentUpdates({ parking: "542" }, "gse"));
  assert(() => validateEquipmentUpdates({ fuel: 150 }, "furgo"), "fuel > 100");
  assert(() => validateEquipmentUpdates({ nitrogeno_1: -1 }, "gse"), "negative psi");
  assert(() => validateEquipmentUpdates({ nitrogeno_1: NaN }, "gse"), "nan psi");
  console.log("equipment-validate self-check OK");
}
