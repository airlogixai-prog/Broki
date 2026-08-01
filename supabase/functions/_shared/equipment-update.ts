/** Maps dashboard equipment update payloads to broki_assets columns. */

export function applyEquipmentUpdates(
  updates: Record<string, unknown>,
  type: string,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const isFurgo = type === "furgo" || type === "vehicle";

  const parkingValue =
    "parking" in updates
      ? updates.parking
      : "location" in updates
        ? updates.location
        : undefined;
  if (parkingValue !== undefined) {
    patch.parking = parkingValue;
  }

  if ("usual_location" in updates) {
    patch.ubicacion_habitual = updates.usual_location ?? null;
  }

  if ("plane" in updates) patch.avion_text = updates.plane ?? null;
  if ("worker" in updates) patch.current_worker_text = updates.worker ?? null;
  if ("fuel" in updates) {
    const v = updates.fuel;
    patch.combustible = v === null || v === "" ? null : Number(v);
  }
  if ("adblue" in updates) {
    const v = updates.adblue;
    patch.adblue = v === null || v === "" ? null : Number(v);
  }
  if ("matricula" in updates) patch.matricula = updates.matricula ?? null;
  if ("descripcion" in updates) patch.descripcion = updates.descripcion ?? null;
  if ("plazas" in updates) {
    const v = updates.plazas;
    patch.plazas = v === null || v === "" ? null : String(v);
  }
  if ("status" in updates) patch.estado = updates.status ?? null;
  if ("notes" in updates) patch.notas = updates.notes ?? null;
  for (const n of ["nitrogeno_1", "nitrogeno_2", "nitrogeno_3", "nitrogeno_4"] as const) {
    if (n in updates) {
      const v = updates[n];
      patch[n] = v === null || v === "" ? null : Number(v);
    }
  }

  // ponytail: isFurgo kept for API compat; furgo and GSE both map location/parking → parking only
  void isFurgo;

  return patch;
}

// Self-check: `deno run supabase/functions/_shared/equipment-update.ts`
if (import.meta.main) {
  const assert = (cond: unknown, msg: string) => {
    if (!cond) throw new Error(`FAIL: ${msg}`);
  };

  const gseParking = applyEquipmentUpdates({ location: "542" }, "gse");
  assert(gseParking.parking === "542", "GSE location → parking only");
  assert(!("ubicacion_habitual" in gseParking), "GSE location must not touch ubicacion_habitual");

  const gseExplicit = applyEquipmentUpdates({ parking: "305" }, "gse");
  assert(gseExplicit.parking === "305", "GSE parking field");
  assert(!("ubicacion_habitual" in gseExplicit), "GSE parking must not touch ubicacion_habitual");

  const gseUsual = applyEquipmentUpdates({ usual_location: "T4S" }, "gse");
  assert(gseUsual.ubicacion_habitual === "T4S", "usual_location → ubicacion_habitual");
  assert(!("parking" in gseUsual), "usual_location must not touch parking");

  const furgo = applyEquipmentUpdates({ location: "520" }, "furgo");
  assert(furgo.parking === "520", "furgo location → parking");
  assert(!("ubicacion_habitual" in furgo), "furgo must not touch ubicacion_habitual");

  const both = applyEquipmentUpdates({ parking: "100", usual_location: "BASE" }, "gse");
  assert(both.parking === "100" && both.ubicacion_habitual === "BASE", "parking and usual_location independent");

  console.log("equipment-update self-check OK");
}
